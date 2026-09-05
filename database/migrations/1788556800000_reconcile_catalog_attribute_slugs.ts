import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Forward repair for installations that ran the catalog migration before 15bf8a9.
 * The original migration remains the clean-install baseline; applied history must
 * not be edited again. This frozen function snapshot intentionally duplicates it.
 */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      if (!db.isTransaction) {
        throw new Error('Catalog reconciliation requires transactional migrations')
      }

      // Bound lock waits and each statement during the coordinated pilot rollout.
      await db.rawQuery("SET LOCAL lock_timeout = '5s'")
      await db.rawQuery("SET LOCAL statement_timeout = '60s'")

      // The eligible refresh bumps tenant_versions first, but canonical delete
      // touches the projection first. Deploy only with writers quiescent: after
      // draining version writers, NOWAIT refuses a projection lock held by an
      // inverse-order writer instead of waiting in a deadlock cycle.
      await db.rawQuery('LOCK TABLE catalog_tenant_versions IN SHARE ROW EXCLUSIVE MODE')
      await db.rawQuery('LOCK TABLE catalog_establishments IN ACCESS EXCLUSIVE MODE NOWAIT')

      // Existing rows are rebuilt from published sources before NOT NULL is set.
      // IF NOT EXISTS also accepts the already repaired production schema.
      await db.rawQuery(`
        ALTER TABLE catalog_establishments
        ADD COLUMN IF NOT EXISTS attribute_slugs text[]
      `)

      // A matching name is insufficient: varchar(n)[] can silently narrow slugs.
      // The ALTER above holds the table lock. Refuse unknown types before touching
      // the function, indexes or projection; no automatic cast/normalization.
      await db.rawQuery(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_attribute
            WHERE attrelid = 'catalog_establishments'::regclass
              AND attname = 'attribute_slugs' AND NOT attisdropped
              AND atttypid = 'text[]'::regtype AND atttypmod = -1
              AND attgenerated = ''
          ) THEN
            RAISE EXCEPTION 'Catalog reconciliation refused: attribute_slugs must be a plain text[] column';
          END IF;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_establishment(
          p_tenant_id integer,
          p_establishment_id integer
        )
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          source_row record;
          category_items jsonb := '[]'::jsonb;
          category_ids_value integer[] := ARRAY[]::integer[];
          category_slugs_value text[] := ARRAY[]::text[];
          active_category_count integer := 0;
          attribute_items jsonb := '[]'::jsonb;
          attribute_search_text text := '';
          attribute_slugs_value text[] := ARRAY[]::text[];
          weekly_items jsonb := '[]'::jsonb;
          special_items jsonb := '[]'::jsonb;
          media_items jsonb := '[]'::jsonb;
          cover_item jsonb := NULL;
          approved_cover_count integer := 0;
          discoverable boolean := false;
          search_document text := '';
          next_projection_version bigint;
        BEGIN
          SELECT
            e.tenant_id,
            e.id AS establishment_id,
            e.organization_id,
            e.lifecycle_status,
            e.business_status,
            e.published_revision_id,
            t.is_active AS tenant_is_active,
            o.status AS organization_status,
            r.status AS revision_status,
            r.city_id,
            r.public_name,
            r.slug AS establishment_slug,
            r.short_description,
            r.description,
            r.public_phone,
            r.whatsapp,
            r.public_email,
            r.website,
            r.instagram,
            r.booking_url,
            r.availability_type,
            r.reviewed_at,
            r.updated_at AS revision_updated_at,
            c.slug AS city_slug,
            c.name AS city_name,
            c.state_code AS city_state_code,
            c.timezone AS city_timezone,
            c.is_active AS city_is_active,
            rg.is_active AS region_is_active,
            address.postal_code,
            address.street,
            address.number,
            address.without_number,
            address.complement,
            address.district,
            address.reference,
            address.latitude,
            address.longitude
          INTO source_row
          FROM establishments e
          JOIN tenants t
            ON t.id = e.tenant_id
          JOIN organizations o
            ON o.id = e.organization_id
           AND o.tenant_id = e.tenant_id
          JOIN establishment_revisions r
            ON r.id = e.published_revision_id
           AND r.tenant_id = e.tenant_id
           AND r.establishment_id = e.id
          JOIN cities c
            ON c.id = r.city_id
           AND c.tenant_id = r.tenant_id
          JOIN regions rg
            ON rg.id = c.region_id
           AND rg.tenant_id = c.tenant_id
          LEFT JOIN establishment_revision_addresses address
            ON address.revision_id = r.id
           AND address.tenant_id = r.tenant_id
          WHERE e.tenant_id = p_tenant_id
            AND e.id = p_establishment_id;

          IF NOT FOUND
            OR source_row.tenant_is_active IS NOT TRUE
            OR source_row.organization_status <> 'active'
            OR source_row.lifecycle_status <> 'active'
            OR source_row.revision_status <> 'approved'
            OR source_row.city_is_active IS NOT TRUE
            OR source_row.region_is_active IS NOT TRUE
          THEN
            PERFORM catalog_delete_establishment(p_tenant_id, p_establishment_id);
            RETURN;
          END IF;

          SELECT
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'slug', category.slug,
                  'name', category.name,
                  'description', category.description,
                  'icon', category.icon,
                  'family', jsonb_build_object(
                    'slug', family.slug,
                    'name', family.name,
                    'icon', family.icon
                  ),
                  'is_primary', revision_category.is_primary,
                  'sort_order', revision_category.sort_order
                )
                ORDER BY
                  revision_category.is_primary DESC,
                  revision_category.sort_order ASC,
                  category.name ASC
              ),
              '[]'::jsonb
            ),
            coalesce(
              array_agg(
                category.id
                ORDER BY
                  revision_category.is_primary DESC,
                  revision_category.sort_order ASC,
                  category.id ASC
              ),
              ARRAY[]::integer[]
            ),
            coalesce(
              array_agg(
                category.slug
                ORDER BY
                  revision_category.is_primary DESC,
                  revision_category.sort_order ASC,
                  category.slug ASC
              ),
              ARRAY[]::text[]
            ),
            count(*)::integer
          INTO
            category_items,
            category_ids_value,
            category_slugs_value,
            active_category_count
          FROM establishment_revision_categories revision_category
          JOIN categories category
            ON category.id = revision_category.category_id
           AND category.tenant_id = revision_category.tenant_id
           AND category.is_active = true
          JOIN category_families family
            ON family.id = category.family_id
           AND family.tenant_id = category.tenant_id
           AND family.is_active = true
          WHERE revision_category.tenant_id = source_row.tenant_id
            AND revision_category.revision_id = source_row.published_revision_id;

          SELECT
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'key', definition.key,
                  'name', definition.name,
                  'description', definition.description,
                  'type', definition.data_type,
                  'unit', definition.unit,
                  'value',
                    CASE definition.data_type
                      WHEN 'boolean' THEN to_jsonb(attribute_value.value_boolean)
                      WHEN 'integer' THEN to_jsonb(attribute_value.value_integer)
                      WHEN 'decimal' THEN to_jsonb(attribute_value.value_decimal)
                      WHEN 'url' THEN to_jsonb(attribute_value.value_url)
                      WHEN 'text' THEN to_jsonb(attribute_value.value_text)
                      WHEN 'long_text' THEN to_jsonb(attribute_value.value_text)
                      ELSE NULL
                    END,
                  'options', coalesce(
                    (
                      SELECT jsonb_agg(
                        jsonb_build_object(
                          'label', option.label,
                          'value', option.value
                        )
                        ORDER BY option.sort_order ASC, option.label ASC
                      )
                      FROM establishment_revision_attribute_value_options selected
                      JOIN category_attribute_options option
                        ON option.id = selected.attribute_option_id
                       AND option.tenant_id = selected.tenant_id
                       AND option.is_active = true
                      WHERE selected.tenant_id = attribute_value.tenant_id
                        AND selected.attribute_value_id = attribute_value.id
                    ),
                    '[]'::jsonb
                  )
                )
                ORDER BY definition.sort_order ASC, definition.name ASC
              ),
              '[]'::jsonb
            ),
            coalesce(
              string_agg(
                concat_ws(
                  ' ',
                  definition.name,
                  definition.key,
                  attribute_value.value_text,
                  attribute_value.value_integer::text,
                  attribute_value.value_decimal::text,
                  attribute_value.value_url,
                  CASE
                    WHEN attribute_value.value_boolean IS TRUE THEN 'sim'
                    WHEN attribute_value.value_boolean IS FALSE THEN 'não'
                    ELSE NULL
                  END,
                  (
                    SELECT string_agg(option.label || ' ' || option.value, ' ')
                    FROM establishment_revision_attribute_value_options selected
                    JOIN category_attribute_options option
                      ON option.id = selected.attribute_option_id
                     AND option.tenant_id = selected.tenant_id
                     AND option.is_active = true
                    WHERE selected.tenant_id = attribute_value.tenant_id
                      AND selected.attribute_value_id = attribute_value.id
                  )
                ),
                ' '
              ),
              ''
            ),
            coalesce(
              array_agg(definition.key ORDER BY definition.key ASC) FILTER (
                WHERE definition.data_type = 'boolean'
                  AND attribute_value.value_boolean IS TRUE
              ),
              ARRAY[]::text[]
            )
          INTO attribute_items, attribute_search_text, attribute_slugs_value
          FROM establishment_revision_attribute_values attribute_value
          JOIN category_attribute_definitions definition
            ON definition.id = attribute_value.attribute_definition_id
           AND definition.tenant_id = attribute_value.tenant_id
           AND definition.is_active = true
           AND definition.is_public = true
          WHERE attribute_value.tenant_id = source_row.tenant_id
            AND attribute_value.revision_id = source_row.published_revision_id;

          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'weekday', weekday,
                'opens_at', opens_at,
                'closes_at', closes_at,
                'spans_next_day', spans_next_day,
                'sort_order', sort_order
              )
              ORDER BY weekday ASC, sort_order ASC, opens_at ASC
            ),
            '[]'::jsonb
          )
          INTO weekly_items
          FROM establishment_revision_hours
          WHERE tenant_id = source_row.tenant_id
            AND revision_id = source_row.published_revision_id;

          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'date', to_char(special_day.date, 'YYYY-MM-DD'),
                'status', special_day.status,
                'note', special_day.note,
                'intervals', coalesce(
                  (
                    SELECT jsonb_agg(
                      jsonb_build_object(
                        'opens_at', special_hour.opens_at,
                        'closes_at', special_hour.closes_at,
                        'spans_next_day', special_hour.spans_next_day,
                        'sort_order', special_hour.sort_order
                      )
                      ORDER BY special_hour.sort_order ASC, special_hour.opens_at ASC
                    )
                    FROM establishment_revision_special_hours special_hour
                    WHERE special_hour.tenant_id = special_day.tenant_id
                      AND special_hour.special_day_id = special_day.id
                  ),
                  '[]'::jsonb
                )
              )
              ORDER BY special_day.date ASC
            ),
            '[]'::jsonb
          )
          INTO special_items
          FROM establishment_revision_special_days special_day
          WHERE special_day.tenant_id = source_row.tenant_id
            AND special_day.revision_id = source_row.published_revision_id;

          SELECT
            coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'purpose', revision_media.purpose,
                  'is_cover', revision_media.is_cover,
                  'sort_order', revision_media.sort_order,
                  'alt_text', revision_media.alt_text,
                  'caption', revision_media.caption,
                  'asset', jsonb_build_object(
                    'url', stored_file.url,
                    'mime_type', asset.mime_type,
                    'file_extension', asset.file_extension,
                    'width', asset.width,
                    'height', asset.height
                  )
                )
                ORDER BY
                  revision_media.is_cover DESC,
                  revision_media.sort_order ASC,
                  revision_media.id ASC
              ),
              '[]'::jsonb
            ),
            count(*) FILTER (WHERE revision_media.is_cover = true)::integer
          INTO media_items, approved_cover_count
          FROM establishment_revision_media revision_media
          JOIN media_assets asset
            ON asset.id = revision_media.media_asset_id
           AND asset.tenant_id = revision_media.tenant_id
           AND asset.establishment_id = revision_media.establishment_id
          JOIN files stored_file
            ON stored_file.id = asset.file_id
           AND stored_file.tenant_id = asset.tenant_id
          WHERE revision_media.tenant_id = source_row.tenant_id
            AND revision_media.revision_id = source_row.published_revision_id
            AND revision_media.moderation_status = 'approved';

          SELECT jsonb_build_object(
            'purpose', revision_media.purpose,
            'is_cover', true,
            'sort_order', revision_media.sort_order,
            'alt_text', revision_media.alt_text,
            'caption', revision_media.caption,
            'asset', jsonb_build_object(
              'url', stored_file.url,
              'mime_type', asset.mime_type,
              'file_extension', asset.file_extension,
              'width', asset.width,
              'height', asset.height
            )
          )
          INTO cover_item
          FROM establishment_revision_media revision_media
          JOIN media_assets asset
            ON asset.id = revision_media.media_asset_id
           AND asset.tenant_id = revision_media.tenant_id
           AND asset.establishment_id = revision_media.establishment_id
          JOIN files stored_file
            ON stored_file.id = asset.file_id
           AND stored_file.tenant_id = asset.tenant_id
          WHERE revision_media.tenant_id = source_row.tenant_id
            AND revision_media.revision_id = source_row.published_revision_id
            AND revision_media.moderation_status = 'approved'
            AND revision_media.is_cover = true
          ORDER BY revision_media.id ASC
          LIMIT 1;

          discoverable :=
            source_row.business_status <> 'permanently_closed'
            AND active_category_count > 0
            AND approved_cover_count = 1;

          search_document := concat_ws(
            ' ',
            source_row.public_name,
            source_row.short_description,
            source_row.description,
            source_row.city_name,
            source_row.district,
            (
              SELECT string_agg(
                concat_ws(' ', category.name, category.slug, family.name, family.slug),
                ' '
              )
              FROM establishment_revision_categories revision_category
              JOIN categories category
                ON category.id = revision_category.category_id
               AND category.tenant_id = revision_category.tenant_id
               AND category.is_active = true
              JOIN category_families family
                ON family.id = category.family_id
               AND family.tenant_id = category.tenant_id
               AND family.is_active = true
              WHERE revision_category.tenant_id = source_row.tenant_id
                AND revision_category.revision_id = source_row.published_revision_id
            ),
            attribute_search_text
          );

          next_projection_version := catalog_bump_tenant_version(source_row.tenant_id);

          INSERT INTO catalog_establishments (
            establishment_id,
            tenant_id,
            organization_id,
            published_revision_id,
            city_id,
            city_slug,
            city_name,
            city_state_code,
            city_timezone,
            establishment_slug,
            public_name,
            normalized_name,
            short_description,
            description,
            public_phone,
            whatsapp,
            public_email,
            website,
            instagram,
            booking_url,
            business_status,
            availability_type,
            address,
            latitude,
            longitude,
            categories,
            category_ids,
            category_slugs,
            attribute_slugs,
            public_attributes,
            weekly_hours,
            special_days,
            media,
            cover_media,
            search_text,
            search_vector,
            is_discoverable,
            is_sponsored,
            sponsored_priority,
            projection_version,
            published_at,
            public_updated_at,
            created_at,
            updated_at
          )
          VALUES (
            source_row.establishment_id,
            source_row.tenant_id,
            source_row.organization_id,
            source_row.published_revision_id,
            source_row.city_id,
            source_row.city_slug,
            source_row.city_name,
            source_row.city_state_code,
            source_row.city_timezone,
            source_row.establishment_slug,
            source_row.public_name,
            source_row.public_name,
            source_row.short_description,
            source_row.description,
            source_row.public_phone,
            source_row.whatsapp,
            source_row.public_email,
            source_row.website,
            source_row.instagram,
            source_row.booking_url,
            source_row.business_status,
            source_row.availability_type,
            jsonb_build_object(
              'postal_code', source_row.postal_code,
              'street', source_row.street,
              'number', source_row.number,
              'without_number', coalesce(source_row.without_number, false),
              'complement', source_row.complement,
              'district', source_row.district,
              'reference', source_row.reference,
              'latitude', source_row.latitude,
              'longitude', source_row.longitude
            ),
            source_row.latitude,
            source_row.longitude,
            category_items,
            category_ids_value,
            category_slugs_value,
            attribute_slugs_value,
            attribute_items,
            weekly_items,
            special_items,
            media_items,
            cover_item,
            search_document,
            to_tsvector('portuguese', ''),
            discoverable,
            false,
            NULL,
            next_projection_version::integer,
            coalesce(source_row.reviewed_at, source_row.revision_updated_at),
            source_row.revision_updated_at,
            now(),
            now()
          )
          ON CONFLICT (establishment_id)
          DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            organization_id = EXCLUDED.organization_id,
            published_revision_id = EXCLUDED.published_revision_id,
            city_id = EXCLUDED.city_id,
            city_slug = EXCLUDED.city_slug,
            city_name = EXCLUDED.city_name,
            city_state_code = EXCLUDED.city_state_code,
            city_timezone = EXCLUDED.city_timezone,
            establishment_slug = EXCLUDED.establishment_slug,
            public_name = EXCLUDED.public_name,
            short_description = EXCLUDED.short_description,
            description = EXCLUDED.description,
            public_phone = EXCLUDED.public_phone,
            whatsapp = EXCLUDED.whatsapp,
            public_email = EXCLUDED.public_email,
            website = EXCLUDED.website,
            instagram = EXCLUDED.instagram,
            booking_url = EXCLUDED.booking_url,
            business_status = EXCLUDED.business_status,
            availability_type = EXCLUDED.availability_type,
            address = EXCLUDED.address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            categories = EXCLUDED.categories,
            category_ids = EXCLUDED.category_ids,
            category_slugs = EXCLUDED.category_slugs,
            attribute_slugs = EXCLUDED.attribute_slugs,
            public_attributes = EXCLUDED.public_attributes,
            weekly_hours = EXCLUDED.weekly_hours,
            special_days = EXCLUDED.special_days,
            media = EXCLUDED.media,
            cover_media = EXCLUDED.cover_media,
            search_text = EXCLUDED.search_text,
            is_discoverable = EXCLUDED.is_discoverable,
            projection_version = EXCLUDED.projection_version,
            published_at = EXCLUDED.published_at,
            public_updated_at = EXCLUDED.public_updated_at,
            updated_at = now();

          DELETE FROM catalog_establishment_categories
          WHERE tenant_id = source_row.tenant_id
            AND establishment_id = source_row.establishment_id;

          INSERT INTO catalog_establishment_categories (
            tenant_id,
            establishment_id,
            category_id,
            family_id,
            category_slug,
            category_name,
            family_slug,
            family_name,
            is_primary,
            sort_order,
            created_at
          )
          SELECT
            revision_category.tenant_id,
            source_row.establishment_id,
            category.id,
            family.id,
            category.slug,
            category.name,
            family.slug,
            family.name,
            revision_category.is_primary,
            revision_category.sort_order,
            now()
          FROM establishment_revision_categories revision_category
          JOIN categories category
            ON category.id = revision_category.category_id
           AND category.tenant_id = revision_category.tenant_id
           AND category.is_active = true
          JOIN category_families family
            ON family.id = category.family_id
           AND family.tenant_id = category.tenant_id
           AND family.is_active = true
          WHERE revision_category.tenant_id = source_row.tenant_id
            AND revision_category.revision_id = source_row.published_revision_id;
        END;
        $$
      `)

      // Reconcile before rebuilding: a divergent unique index could reject writes.
      await db.rawQuery(`
        DO $$
        DECLARE
          target_schema text;
          existing_index regclass;
          index_name constant text := 'catalog_establishments_attribute_slugs_index';
        BEGIN
          SELECT namespace.nspname INTO target_schema
          FROM pg_class relation
          JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
          WHERE relation.oid = 'catalog_establishments'::regclass;

          existing_index := to_regclass(format('%I.%I', target_schema, index_name));
          IF existing_index IS NOT NULL THEN
            IF EXISTS (
              SELECT 1
              FROM pg_index index_state
              JOIN pg_class index_relation ON index_relation.oid = index_state.indexrelid
              JOIN pg_am access_method ON access_method.oid = index_relation.relam
              JOIN pg_opclass operator_class ON operator_class.oid = index_state.indclass[0]
              JOIN pg_attribute attribute
                ON attribute.attrelid = index_state.indrelid
               AND attribute.attname = 'attribute_slugs'
               AND NOT attribute.attisdropped
              WHERE index_state.indexrelid = existing_index
                AND index_state.indrelid = 'catalog_establishments'::regclass
                AND index_state.indisvalid
                AND index_state.indisready
                AND index_state.indislive
                AND NOT index_state.indisunique
                AND NOT index_state.indisprimary
                AND NOT index_state.indisexclusion
                AND index_state.indnatts = 1
                AND index_state.indnkeyatts = 1
                AND index_state.indkey[0] = attribute.attnum
                AND index_state.indcollation[0] = attribute.attcollation
                AND index_state.indoption[0] = 0
                AND index_state.indpred IS NULL
                AND index_state.indexprs IS NULL
                AND access_method.amname = 'gin'
                AND operator_class.opcnamespace = 'pg_catalog'::regnamespace
                AND operator_class.opcname = 'array_ops'
                AND pg_get_indexdef(index_state.indexrelid, 1, true) = 'attribute_slugs'
            ) THEN
              RETURN;
            END IF;

            -- A name match alone can hide a failed concurrent build, another
            -- column/access method, or a partial index. No CASCADE: dependencies
            -- or a non-index name collision must fail the whole transaction.
            EXECUTE format('DROP INDEX %I.%I', target_schema, index_name);
          END IF;

          EXECUTE format(
            'CREATE INDEX %I ON %I.catalog_establishments USING GIN (attribute_slugs)',
            index_name,
            target_schema
          );
        END;
        $$
      `)

      // Visit sources, including published establishments missing from the read
      // model. Refresh also removes ineligible rows and invalidates tenant caches.
      await db.rawQuery(`
        DO $$
        DECLARE
          target record;
        BEGIN
          FOR target IN
            SELECT e.tenant_id, e.id
            FROM establishments e
            WHERE e.published_revision_id IS NOT NULL
               OR EXISTS (
                 SELECT 1
                 FROM catalog_establishments catalog
                 WHERE catalog.tenant_id = e.tenant_id
                   AND catalog.establishment_id = e.id
               )
            ORDER BY e.tenant_id, e.id
          LOOP
            PERFORM catalog_refresh_establishment(target.tenant_id, target.id);
          END LOOP;
        END;
        $$
      `)

      await db.rawQuery(`
        ALTER TABLE catalog_establishments
        ALTER COLUMN attribute_slugs SET NOT NULL,
        ALTER COLUMN attribute_slugs DROP DEFAULT
      `)
    })
  }

  async down() {
    // Intentionally retain the additive repair: these objects may predate this
    // migration (clean install or hotfix), and code rollback still needs them.
    // A full reset drops them with the original create_catalog_projection down.
  }
}
