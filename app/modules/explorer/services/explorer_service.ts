import { inject } from '@adonisjs/core'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import ExplorerItinerary from '#modules/explorer/models/explorer_itinerary'
import ExplorerItineraryItem from '#modules/explorer/models/explorer_itinerary_item'
import ExplorerCatalogRepository from '#modules/explorer/repositories/explorer_catalog_repository'
import ExplorerInterestRepository from '#modules/explorer/repositories/explorer_interest_repository'
import ExplorerItineraryRepository from '#modules/explorer/repositories/explorer_itinerary_repository'
import ExplorerSavedRepository, {
  type SavedKind,
} from '#modules/explorer/repositories/explorer_saved_repository'

/**
 * The Explorer's own layer — ADR-0030, Anexo I item 10.
 *
 * Every method takes the acting user and scopes by them. There is no
 * administrative read here and no route that answers about someone else: the
 * whole module is one person's relationship with the catalogue.
 */
@inject()
export default class ExplorerService {
  constructor(
    private saved: ExplorerSavedRepository,
    private interests: ExplorerInterestRepository,
    private itineraries: ExplorerItineraryRepository,
    private catalog: ExplorerCatalogRepository
  ) {}

  async listSaved(kind: SavedKind, tenantId: number, userId: number): Promise<IExplorer.SavedList> {
    return this.saved.list(kind, tenantId, userId)
  }

  async save(
    kind: SavedKind,
    tenantId: number,
    userId: number,
    establishmentId: number
  ): Promise<void> {
    await this.requireDiscoverable(tenantId, establishmentId)
    await this.saved.save(kind, tenantId, userId, establishmentId)
  }

  async unsave(
    kind: SavedKind,
    tenantId: number,
    userId: number,
    establishmentId: number
  ): Promise<void> {
    // Undoing does not revalidate the catalogue: someone must be able to drop a
    // saved place precisely when it stopped being available.
    await this.saved.remove(kind, tenantId, userId, establishmentId)
  }

  async savedStatus(tenantId: number, userId: number, establishmentId: number) {
    return this.saved.statusFor(tenantId, userId, establishmentId)
  }

  async listInterests(tenantId: number, userId: number) {
    return this.interests.list(tenantId, userId)
  }

  async replaceInterests(
    tenantId: number,
    userId: number,
    categoryIds: number[]
  ): Promise<IExplorer.InterestProjection[]> {
    const unique = [...new Set(categoryIds)]
    const existing = await this.interests.existingCategoryIds(tenantId, unique)
    if (existing.length !== unique.length) {
      // A category of another operation is not forbidden, it is absent: the
      // reply must not confirm that some other tenant owns that number.
      throw new NotFoundException('Category not found')
    }

    await this.interests.replace(tenantId, userId, unique)
    return this.interests.list(tenantId, userId)
  }

  async listItineraries(tenantId: number, userId: number) {
    return this.itineraries.list(tenantId, userId)
  }

  async showItinerary(tenantId: number, userId: number, itineraryId: number) {
    const itinerary = await this.itineraries.show(tenantId, userId, itineraryId)
    if (!itinerary) throw new NotFoundException('Itinerary not found')
    return itinerary
  }

  async createItinerary(
    tenantId: number,
    userId: number,
    payload: IExplorer.ItineraryPayload
  ): Promise<IExplorer.ItineraryProjection> {
    const itinerary = await ExplorerItinerary.create({
      tenant_id: tenantId,
      user_id: userId,
      name: payload.name.trim(),
      notes: payload.notes?.trim() || null,
    })

    return this.showItinerary(tenantId, userId, itinerary.id)
  }

  async updateItinerary(
    tenantId: number,
    userId: number,
    itineraryId: number,
    payload: IExplorer.ItineraryPayload
  ): Promise<IExplorer.ItineraryProjection> {
    const itinerary = await this.requireOwnedItinerary(tenantId, userId, itineraryId)
    itinerary.name = payload.name.trim()
    itinerary.notes = payload.notes?.trim() || null
    await itinerary.save()

    return this.showItinerary(tenantId, userId, itineraryId)
  }

  async deleteItinerary(tenantId: number, userId: number, itineraryId: number): Promise<void> {
    const itinerary = await this.requireOwnedItinerary(tenantId, userId, itineraryId)
    await itinerary.delete()
  }

  async addStop(
    tenantId: number,
    userId: number,
    itineraryId: number,
    payload: IExplorer.StopPayload
  ): Promise<IExplorer.ItineraryProjection> {
    await this.requireOwnedItinerary(tenantId, userId, itineraryId)
    await this.requireDiscoverable(tenantId, payload.establishment_id)

    await ExplorerItineraryItem.create({
      tenant_id: tenantId,
      itinerary_id: itineraryId,
      establishment_id: payload.establishment_id,
      position: payload.position ?? (await this.itineraries.nextPosition(tenantId, itineraryId)),
      note: payload.note?.trim() || null,
    })

    return this.showItinerary(tenantId, userId, itineraryId)
  }

  async removeStop(
    tenantId: number,
    userId: number,
    itineraryId: number,
    stopId: number
  ): Promise<IExplorer.ItineraryProjection> {
    await this.requireOwnedItinerary(tenantId, userId, itineraryId)
    const exists = await this.itineraries.stopExists(tenantId, itineraryId, stopId)
    if (!exists) throw new NotFoundException('Itinerary stop not found')

    const stop = await ExplorerItineraryItem.query()
      .where('tenant_id', tenantId)
      .where('itinerary_id', itineraryId)
      .where('id', stopId)
      .firstOrFail()
    await stop.delete()

    return this.showItinerary(tenantId, userId, itineraryId)
  }

  /**
   * Reordering takes the whole sequence, not a stop and a destination.
   *
   * A partial order would leave the rest of the route to be inferred, and two
   * clients inferring differently is how a saved order silently stops matching
   * what either of them showed.
   */
  async reorderStops(
    tenantId: number,
    userId: number,
    itineraryId: number,
    payload: IExplorer.ReorderPayload
  ): Promise<IExplorer.ItineraryProjection> {
    await this.requireOwnedItinerary(tenantId, userId, itineraryId)

    const owned = await this.itineraries.ownedStopIds(tenantId, itineraryId)
    const given = [...payload.stop_ids]
    const sameSet =
      owned.length === given.length &&
      new Set(given).size === given.length &&
      given.every((id) => owned.includes(id))

    if (!sameSet) {
      throw new BadRequestException('A nova ordem precisa conter exatamente as paradas do roteiro')
    }

    await this.itineraries.applyOrder(tenantId, itineraryId, given)
    return this.showItinerary(tenantId, userId, itineraryId)
  }

  /**
   * Erases the personal layer in every operation — ADR-0030.
   *
   * Takes the caller's transaction on purpose: it runs inside account deletion,
   * and a deletion that tombstoned the user and then failed halfway through the
   * preferences would leave exactly the data the person asked to be rid of.
   */
  async purgeForUser(userId: number, client: any): Promise<void> {
    await this.saved.purgeForUser(userId, client)
    await this.interests.purgeForUser(userId, client)
    await this.itineraries.purgeForUser(userId, client)
  }

  private async requireOwnedItinerary(tenantId: number, userId: number, itineraryId: number) {
    const itinerary = await this.itineraries.findOwned(tenantId, userId, itineraryId)
    if (!itinerary) throw new NotFoundException('Itinerary not found')
    return itinerary
  }

  private async requireDiscoverable(tenantId: number, establishmentId: number): Promise<void> {
    const present = await this.catalog.isDiscoverable(tenantId, establishmentId)
    if (!present) throw new NotFoundException('Establishment not found')
  }
}
