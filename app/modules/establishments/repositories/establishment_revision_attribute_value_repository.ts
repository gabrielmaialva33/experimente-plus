import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

import BadRequestException from '#exceptions/bad_request_exception'
import EstablishmentRevisionAttributeValue from '#modules/establishments/models/establishment_revision_attribute_value'
import EstablishmentRevisionAttributeValueOption from '#modules/establishments/models/establishment_revision_attribute_value_option'
import LucidRepository from '#shared/lucid/lucid_repository'

export interface SelectedAttributeOptionRow {
  tenant_id: number
  attribute_value_id: number
  attribute_definition_id: number
  attribute_option_id: number
}

export default class EstablishmentRevisionAttributeValueRepository extends LucidRepository<
  typeof EstablishmentRevisionAttributeValue
> {
  constructor() {
    super(EstablishmentRevisionAttributeValue)
  }

  async listForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<EstablishmentRevisionAttributeValue[]> {
    return EstablishmentRevisionAttributeValue.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .preload('definition')
      .preload('selected_options', (query) => query.preload('option'))
      .orderBy('attribute_definition_id', 'asc')
  }

  async deleteForRevision(
    tenantId: number,
    revisionId: number,
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionAttributeValue.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
      .delete()
  }

  /**
   * Deletes the values whose definition is not in `definitionIds`. An empty
   * list keeps nothing, so every value of the revision is deleted.
   */
  async deleteOutsideDefinitions(
    tenantId: number,
    revisionId: number,
    definitionIds: readonly number[],
    client: TransactionClientContract
  ): Promise<void> {
    const staleValues = EstablishmentRevisionAttributeValue.query({ client })
      .where('tenant_id', tenantId)
      .where('revision_id', revisionId)
    if (definitionIds.length > 0) {
      staleValues.whereNotIn('attribute_definition_id', [...definitionIds])
    }
    await staleValues.delete()
  }

  async createSelectedOptions(
    rows: SelectedAttributeOptionRow[],
    client: TransactionClientContract
  ): Promise<void> {
    await EstablishmentRevisionAttributeValueOption.createMany(rows, { client })
  }

  /**
   * Copies the attribute values of one revision, and the options selected in
   * them, into a freshly cloned revision with a constant number of statements.
   */
  async copyToRevision(
    sourceRevisionId: number,
    targetRevisionId: number,
    tenantId: number,
    client: TransactionClientContract
  ): Promise<void> {
    const values = await client
      .from('establishment_revision_attribute_values')
      .where('tenant_id', tenantId)
      .where('revision_id', sourceRevisionId)
      .orderBy('id', 'asc')

    if (values.length === 0) return

    const options = await client
      .from('establishment_revision_attribute_value_options')
      .where('tenant_id', tenantId)
      .whereIn(
        'attribute_value_id',
        values.map((value) => value.id)
      )
      .orderBy('id', 'asc')
    const now = new Date()
    const createdValues = await client
      .table('establishment_revision_attribute_values')
      .insert(
        values.map((value) => ({
          tenant_id: tenantId,
          revision_id: targetRevisionId,
          attribute_definition_id: value.attribute_definition_id,
          value_text: value.value_text,
          value_boolean: value.value_boolean,
          value_integer: value.value_integer,
          value_decimal: value.value_decimal,
          value_url: value.value_url,
          created_at: now,
          updated_at: now,
        }))
      )
      .returning(['id', 'attribute_definition_id'])

    if (options.length === 0) return

    const targetValueIdsByDefinition = new Map(
      createdValues.map((value) => [Number(value.attribute_definition_id), Number(value.id)])
    )
    const copiedOptions = options.map((option) => {
      const targetValueId = targetValueIdsByDefinition.get(Number(option.attribute_definition_id))
      if (!targetValueId) {
        throw new BadRequestException('Attribute option source is inconsistent')
      }

      return {
        tenant_id: tenantId,
        attribute_value_id: targetValueId,
        attribute_definition_id: option.attribute_definition_id,
        attribute_option_id: option.attribute_option_id,
        created_at: now,
      }
    })

    // The domain caps a revision at 5,000 selected options: 25,000 bind values here.
    await client.table('establishment_revision_attribute_value_options').insert(copiedOptions)
  }
}
