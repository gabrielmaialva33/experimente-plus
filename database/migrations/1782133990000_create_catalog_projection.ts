import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('catalog_tenant_versions', (table) => {
      table.integer('tenant_id').unsigned().primary()
      table.bigInteger('projection_version').notNullable().defaultTo(1)
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table
        .foreign('tenant_id', 'catalog_tenant_versions_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table.check('projection_version > 0', [], 'catalog_tenant_versions_version_check')
    })

    this.schema.createTable('catalog_establishments', (table) => {
      table.integer('establishment_id').unsigned().primary()
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('organization_id').unsigned().notNullable()
      table.integer('published_revision_id').unsigned().notNullable()
      table.integer('city_id').unsigned().notNullable()

      table.string('city_slug', 160).notNullable()
      table.string('city_name', 160).notNullable()
      table.string('city_state_code', 2).notNullable()
      table.string('city_timezone', 64).notNullable()

      table.string('establishment_slug', 180).notNullable()
      table.string('public_name', 160).notNullable()
      table.string('normalized_name', 180).notNullable()
      table.string('short_description', 320).nullable()
      table.text('description').nullable()

      table.string('public_phone', 32).nullable()
      table.string('whatsapp', 32).nullable()
      table.string('public_email', 254).nullable()
      table.string('website', 2048).nullable()
      table.string('instagram', 160).nullable()
      table.string('booking_url', 2048).nullable()

      table.string('business_status', 32).notNullable()
      table.string('availability_type', 32).notNullable()
      table.jsonb('address').notNullable()
      table.decimal('latitude', 10, 7).nullable()
      table.decimal('longitude', 10, 7).nullable()

      table.jsonb('categories').notNullable()
      table.specificType('category_ids', 'integer[]').notNullable()
      table.specificType('category_slugs', 'text[]').notNullable()
      table.specificType('attribute_slugs', 'text[]').notNullable()
      table.jsonb('public_attributes').notNullable()
      table.jsonb('weekly_hours').notNullable()
      table.jsonb('special_days').notNullable()
      table.jsonb('media').notNullable()
      table.jsonb('cover_media').nullable()

      table.text('search_text').notNullable()
      table.specificType('search_vector', 'tsvector').notNullable()
      table.boolean('is_discoverable').notNullable().defaultTo(false)
      table.boolean('is_sponsored').notNullable().defaultTo(false)
      table.integer('sponsored_priority').nullable()
      table.integer('projection_version').notNullable().defaultTo(1)

      table.timestamp('published_at', { useTz: true }).notNullable()
      table.timestamp('public_updated_at', { useTz: true }).notNullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(
        ['tenant_id', 'establishment_id'],
        'catalog_establishments_tenant_establishment_unique'
      )
      table.unique(
        ['tenant_id', 'city_id', 'establishment_slug'],
        'catalog_establishments_city_slug_unique'
      )

      table
        .foreign('tenant_id', 'catalog_establishments_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(
          ['establishment_id', 'tenant_id'],
          'catalog_establishments_establishment_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('establishments')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign(
          ['published_revision_id', 'tenant_id', 'establishment_id'],
          'catalog_establishments_revision_tenant_foreign'
        )
        .references(['id', 'tenant_id', 'establishment_id'])
        .inTable('establishment_revisions')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign(
          ['organization_id', 'tenant_id'],
          'catalog_establishments_organization_tenant_foreign'
        )
        .references(['id', 'tenant_id'])
        .inTable('organizations')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign(['city_id', 'tenant_id'], 'catalog_establishments_city_tenant_foreign')
        .references(['id', 'tenant_id'])
        .inTable('cities')
        .onDelete('RESTRICT')
        .onUpdate('CASCADE')

      table.index(
        ['tenant_id', 'city_id', 'is_discoverable', 'business_status'],
        'catalog_establishments_discovery_index'
      )
      table.index(
        ['tenant_id', 'city_slug', 'establishment_slug'],
        'catalog_establishments_public_slug_index'
      )
      table.index(
        ['tenant_id', 'is_sponsored', 'sponsored_priority'],
        'catalog_establishments_sponsorship_index'
      )
      table.index(
        ['tenant_id', 'published_at', 'establishment_id'],
        'catalog_establishments_recency_index'
      )

      table.check(
        "business_status IN ('open', 'temporarily_closed', 'permanently_closed')",
        [],
        'catalog_establishments_business_status_check'
      )
      table.check(
        "availability_type IN ('regular_hours', 'appointment_only', 'always_open')",
        [],
        'catalog_establishments_availability_type_check'
      )
      table.check(
        'latitude IS NULL OR latitude BETWEEN -90 AND 90',
        [],
        'catalog_establishments_latitude_check'
      )
      table.check(
        'longitude IS NULL OR longitude BETWEEN -180 AND 180',
        [],
        'catalog_establishments_longitude_check'
      )
      table.check(
        'sponsored_priority IS NULL OR sponsored_priority >= 0',
        [],
        'catalog_establishments_sponsored_priority_check'
      )
      table.check('projection_version > 0', [], 'catalog_establishments_projection_version_check')
    })

    this.schema.createTable('catalog_establishment_categories', (table) => {
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('establishment_id').unsigned().notNullable()
      table.integer('category_id').unsigned().notNullable()
      table.integer('family_id').unsigned().notNullable()
      table.string('category_slug', 160).notNullable()
      table.string('category_name', 160).notNullable()
      table.string('family_slug', 160).notNullable()
      table.string('family_name', 160).notNullable()
      table.boolean('is_primary').notNullable().defaultTo(false)
      table.integer('sort_order').notNullable().defaultTo(0)
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.primary(
        ['tenant_id', 'establishment_id', 'category_id'],
        'catalog_establishment_categories_primary'
      )
      table
        .foreign(
          ['tenant_id', 'establishment_id'],
          'catalog_establishment_categories_catalog_foreign'
        )
        .references(['tenant_id', 'establishment_id'])
        .inTable('catalog_establishments')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign(['category_id', 'tenant_id'], 'catalog_establishment_categories_category_foreign')
        .references(['id', 'tenant_id'])
        .inTable('categories')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')
      table
        .foreign(['family_id', 'tenant_id'], 'catalog_establishment_categories_family_foreign')
        .references(['id', 'tenant_id'])
        .inTable('category_families')
        .onDelete('CASCADE')
        .onUpdate('CASCADE')

      table.index(
        ['tenant_id', 'category_id', 'establishment_id'],
        'catalog_establishment_categories_category_index'
      )
      table.index(
        ['tenant_id', 'category_slug', 'establishment_id'],
        'catalog_establishment_categories_slug_index'
      )
      table.index(
        ['tenant_id', 'family_id', 'establishment_id'],
        'catalog_establishment_categories_family_index'
      )
    })

    this.defer(async (db) => {
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS unaccent')
      await db.rawQuery('CREATE EXTENSION IF NOT EXISTS pg_trgm')

      await db.rawQuery(`
        CREATE INDEX catalog_establishments_search_vector_index
        ON catalog_establishments
        USING GIN (search_vector)
      `)
      await db.rawQuery(`
        CREATE INDEX catalog_establishments_normalized_name_trgm_index
        ON catalog_establishments
        USING GIN (normalized_name gin_trgm_ops)
      `)
      await db.rawQuery(`
        CREATE INDEX catalog_establishments_search_text_trgm_index
        ON catalog_establishments
        USING GIN (search_text gin_trgm_ops)
      `)
      await db.rawQuery(`
        CREATE INDEX catalog_establishments_category_ids_index
        ON catalog_establishments
        USING GIN (category_ids)
      `)
      await db.rawQuery(`
        CREATE INDEX catalog_establishments_category_slugs_index
        ON catalog_establishments
        USING GIN (category_slugs)
      `)

      await db.rawQuery(`
        CREATE INDEX catalog_establishments_attribute_slugs_index
        ON catalog_establishments
        USING GIN (attribute_slugs)
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_normalize_text(value text)
        RETURNS text
        LANGUAGE sql
        STABLE
        PARALLEL SAFE
        AS $$
          SELECT btrim(
            regexp_replace(
              lower(unaccent(coalesce(value, ''))),
              '[^a-z0-9]+',
              ' ',
              'g'
            )
          )
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_prepare_search_document()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          NEW.normalized_name := catalog_normalize_text(NEW.public_name);
          NEW.search_text := catalog_normalize_text(NEW.search_text);
          NEW.search_vector := to_tsvector('portuguese', NEW.search_text);
          NEW.updated_at := now();
          RETURN NEW;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE TRIGGER catalog_establishments_search_document_trigger
        BEFORE INSERT OR UPDATE OF public_name, search_text
        ON catalog_establishments
        FOR EACH ROW
        EXECUTE FUNCTION catalog_prepare_search_document()
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_bump_tenant_version(p_tenant_id integer)
        RETURNS bigint
        LANGUAGE plpgsql
        AS $$
        DECLARE
          next_version bigint;
        BEGIN
          INSERT INTO catalog_tenant_versions (tenant_id, projection_version, updated_at)
          VALUES (p_tenant_id, 1, now())
          ON CONFLICT (tenant_id)
          DO UPDATE SET
            projection_version = catalog_tenant_versions.projection_version + 1,
            updated_at = now()
          RETURNING projection_version INTO next_version;

          RETURN next_version;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_delete_establishment(
          p_tenant_id integer,
          p_establishment_id integer
        )
        RETURNS void
        LANGUAGE plpgsql
        AS $$
        DECLARE
          deleted_count integer;
        BEGIN
          DELETE FROM catalog_establishments
          WHERE tenant_id = p_tenant_id
            AND establishment_id = p_establishment_id;

          GET DIAGNOSTICS deleted_count = ROW_COUNT;

          IF deleted_count > 0 THEN
            PERFORM catalog_bump_tenant_version(p_tenant_id);
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

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_is_open_now(
          p_availability_type text,
          p_business_status text,
          p_timezone text,
          p_weekly_hours jsonb,
          p_special_days jsonb,
          p_at timestamptz DEFAULT now()
        )
        RETURNS boolean
        LANGUAGE plpgsql
        STABLE
        AS $$
        DECLARE
          local_timestamp timestamp;
          local_date date;
          local_time time;
          local_weekday integer;
          previous_weekday integer;
          current_special jsonb;
          previous_special jsonb;
          interval_item jsonb;
        BEGIN
          IF p_business_status <> 'open' OR p_availability_type = 'appointment_only' THEN
            RETURN false;
          END IF;

          local_timestamp := p_at AT TIME ZONE p_timezone;
          local_date := local_timestamp::date;
          local_time := local_timestamp::time;
          local_weekday := extract(dow FROM local_timestamp)::integer;
          previous_weekday := (local_weekday + 6) % 7;

          SELECT item
          INTO current_special
          FROM jsonb_array_elements(coalesce(p_special_days, '[]'::jsonb)) item
          WHERE item->>'date' = to_char(local_date, 'YYYY-MM-DD')
          LIMIT 1;

          IF current_special IS NOT NULL THEN
            IF current_special->>'status' = 'closed' THEN
              RETURN false;
            END IF;

            IF current_special->>'status' = 'custom_hours' THEN
              FOR interval_item IN
                SELECT value
                FROM jsonb_array_elements(coalesce(current_special->'intervals', '[]'::jsonb))
              LOOP
                IF coalesce((interval_item->>'spans_next_day')::boolean, false) THEN
                  IF local_time >= (interval_item->>'opens_at')::time THEN
                    RETURN true;
                  END IF;
                ELSIF local_time >= (interval_item->>'opens_at')::time
                  AND local_time < (interval_item->>'closes_at')::time
                THEN
                  RETURN true;
                END IF;
              END LOOP;

              RETURN false;
            END IF;
          END IF;

          SELECT item
          INTO previous_special
          FROM jsonb_array_elements(coalesce(p_special_days, '[]'::jsonb)) item
          WHERE item->>'date' = to_char(local_date - 1, 'YYYY-MM-DD')
            AND item->>'status' = 'custom_hours'
          LIMIT 1;

          IF previous_special IS NOT NULL THEN
            FOR interval_item IN
              SELECT value
              FROM jsonb_array_elements(coalesce(previous_special->'intervals', '[]'::jsonb))
            LOOP
              IF coalesce((interval_item->>'spans_next_day')::boolean, false)
                AND local_time < (interval_item->>'closes_at')::time
              THEN
                RETURN true;
              END IF;
            END LOOP;
          END IF;

          IF p_availability_type = 'always_open' THEN
            RETURN true;
          END IF;

          FOR interval_item IN
            SELECT value
            FROM jsonb_array_elements(coalesce(p_weekly_hours, '[]'::jsonb))
            WHERE (value->>'weekday')::integer = local_weekday
          LOOP
            IF coalesce((interval_item->>'spans_next_day')::boolean, false) THEN
              IF local_time >= (interval_item->>'opens_at')::time THEN
                RETURN true;
              END IF;
            ELSIF local_time >= (interval_item->>'opens_at')::time
              AND local_time < (interval_item->>'closes_at')::time
            THEN
              RETURN true;
            END IF;
          END LOOP;

          FOR interval_item IN
            SELECT value
            FROM jsonb_array_elements(coalesce(p_weekly_hours, '[]'::jsonb))
            WHERE (value->>'weekday')::integer = previous_weekday
              AND coalesce((value->>'spans_next_day')::boolean, false)
          LOOP
            IF local_time < (interval_item->>'closes_at')::time THEN
              RETURN true;
            END IF;
          END LOOP;

          RETURN false;
        EXCEPTION
          WHEN invalid_parameter_value OR invalid_datetime_format THEN
            RETURN false;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_establishment_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          IF TG_OP = 'DELETE' THEN
            PERFORM catalog_delete_establishment(OLD.tenant_id, OLD.id);
            RETURN OLD;
          END IF;

          PERFORM catalog_refresh_establishment(NEW.tenant_id, NEW.id);

          IF TG_OP = 'UPDATE'
            AND (OLD.tenant_id, OLD.id) IS DISTINCT FROM (NEW.tenant_id, NEW.id)
          THEN
            PERFORM catalog_delete_establishment(OLD.tenant_id, OLD.id);
          END IF;

          RETURN NEW;
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_revision_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_establishment_id integer;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_establishment_id := coalesce(NEW.establishment_id, OLD.establishment_id);
          PERFORM catalog_refresh_establishment(target_tenant_id, target_establishment_id);
          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_revision_child_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_revision_id integer;
          target_establishment_id integer;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_revision_id := coalesce(NEW.revision_id, OLD.revision_id);

          SELECT establishment_id
          INTO target_establishment_id
          FROM establishment_revisions
          WHERE tenant_id = target_tenant_id
            AND id = target_revision_id;

          IF target_establishment_id IS NOT NULL THEN
            PERFORM catalog_refresh_establishment(target_tenant_id, target_establishment_id);
          END IF;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_attribute_option_selection_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_attribute_value_id integer;
          target_revision_id integer;
          target_establishment_id integer;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_attribute_value_id := coalesce(NEW.attribute_value_id, OLD.attribute_value_id);

          SELECT value.revision_id, revision.establishment_id
          INTO target_revision_id, target_establishment_id
          FROM establishment_revision_attribute_values value
          JOIN establishment_revisions revision
            ON revision.id = value.revision_id
           AND revision.tenant_id = value.tenant_id
          WHERE value.tenant_id = target_tenant_id
            AND value.id = target_attribute_value_id;

          IF target_establishment_id IS NOT NULL THEN
            PERFORM catalog_refresh_establishment(target_tenant_id, target_establishment_id);
          END IF;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_special_hour_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_special_day_id integer;
          target_revision_id integer;
          target_establishment_id integer;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_special_day_id := coalesce(NEW.special_day_id, OLD.special_day_id);

          SELECT special_day.revision_id, revision.establishment_id
          INTO target_revision_id, target_establishment_id
          FROM establishment_revision_special_days special_day
          JOIN establishment_revisions revision
            ON revision.id = special_day.revision_id
           AND revision.tenant_id = special_day.tenant_id
          WHERE special_day.tenant_id = target_tenant_id
            AND special_day.id = target_special_day_id;

          IF target_establishment_id IS NOT NULL THEN
            PERFORM catalog_refresh_establishment(target_tenant_id, target_establishment_id);
          END IF;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_media_asset_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_asset_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_asset_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision_media.establishment_id
            FROM establishment_revision_media revision_media
            WHERE revision_media.tenant_id = target_tenant_id
              AND revision_media.media_asset_id = target_asset_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_file_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_file_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_file_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT asset.establishment_id
            FROM media_assets asset
            WHERE asset.tenant_id = target_tenant_id
              AND asset.file_id = target_file_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_organization_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_organization_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_organization_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT id
            FROM establishments
            WHERE tenant_id = target_tenant_id
              AND organization_id = target_organization_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_city_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_city_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_city_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM establishment_revisions revision
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE revision.tenant_id = target_tenant_id
              AND revision.city_id = target_city_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_region_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_region_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_region_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM cities city
            JOIN establishment_revisions revision
              ON revision.city_id = city.id
             AND revision.tenant_id = city.tenant_id
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE city.tenant_id = target_tenant_id
              AND city.region_id = target_region_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_category_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_category_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_category_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM establishment_revision_categories revision_category
            JOIN establishment_revisions revision
              ON revision.id = revision_category.revision_id
             AND revision.tenant_id = revision_category.tenant_id
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE revision_category.tenant_id = target_tenant_id
              AND revision_category.category_id = target_category_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_category_family_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_family_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_family_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM categories category
            JOIN establishment_revision_categories revision_category
              ON revision_category.category_id = category.id
             AND revision_category.tenant_id = category.tenant_id
            JOIN establishment_revisions revision
              ON revision.id = revision_category.revision_id
             AND revision.tenant_id = revision_category.tenant_id
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE category.tenant_id = target_tenant_id
              AND category.family_id = target_family_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_attribute_definition_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_definition_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_definition_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM establishment_revision_attribute_values attribute_value
            JOIN establishment_revisions revision
              ON revision.id = attribute_value.revision_id
             AND revision.tenant_id = attribute_value.tenant_id
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE attribute_value.tenant_id = target_tenant_id
              AND attribute_value.attribute_definition_id = target_definition_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_attribute_option_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target_option_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.tenant_id, OLD.tenant_id);
          target_option_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT DISTINCT revision.establishment_id
            FROM establishment_revision_attribute_value_options selected
            JOIN establishment_revision_attribute_values attribute_value
              ON attribute_value.id = selected.attribute_value_id
             AND attribute_value.tenant_id = selected.tenant_id
            JOIN establishment_revisions revision
              ON revision.id = attribute_value.revision_id
             AND revision.tenant_id = attribute_value.tenant_id
            JOIN establishments establishment
              ON establishment.id = revision.establishment_id
             AND establishment.tenant_id = revision.tenant_id
             AND establishment.published_revision_id = revision.id
            WHERE selected.tenant_id = target_tenant_id
              AND selected.attribute_option_id = target_option_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.establishment_id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      await db.rawQuery(`
        CREATE OR REPLACE FUNCTION catalog_refresh_from_tenant_trigger()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        DECLARE
          target_tenant_id integer;
          target record;
        BEGIN
          target_tenant_id := coalesce(NEW.id, OLD.id);

          FOR target IN
            SELECT id
            FROM establishments
            WHERE tenant_id = target_tenant_id
          LOOP
            PERFORM catalog_refresh_establishment(target_tenant_id, target.id);
          END LOOP;

          RETURN coalesce(NEW, OLD);
        END;
        $$
      `)

      const triggerStatements = [
        `CREATE TRIGGER catalog_refresh_establishments_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishments
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_establishment_trigger()`,
        `CREATE TRIGGER catalog_refresh_revisions_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revisions
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_trigger()`,
        `CREATE TRIGGER catalog_refresh_addresses_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_addresses
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_revision_categories_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_categories
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_attribute_values_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_attribute_values
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_attribute_value_options_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_attribute_value_options
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_attribute_option_selection_trigger()`,
        `CREATE TRIGGER catalog_refresh_hours_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_hours
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_special_days_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_special_days
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_special_hours_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_special_hours
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_special_hour_trigger()`,
        `CREATE TRIGGER catalog_refresh_revision_media_trigger
         AFTER INSERT OR UPDATE OR DELETE ON establishment_revision_media
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_revision_child_trigger()`,
        `CREATE TRIGGER catalog_refresh_media_assets_trigger
         AFTER UPDATE OR DELETE ON media_assets
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_media_asset_trigger()`,
        `CREATE TRIGGER catalog_refresh_files_trigger
         AFTER UPDATE OR DELETE ON files
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_file_trigger()`,
        `CREATE TRIGGER catalog_refresh_organizations_trigger
         AFTER UPDATE OR DELETE ON organizations
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_organization_trigger()`,
        `CREATE TRIGGER catalog_refresh_cities_trigger
         AFTER UPDATE OR DELETE ON cities
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_city_trigger()`,
        `CREATE TRIGGER catalog_refresh_regions_trigger
         AFTER UPDATE OR DELETE ON regions
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_region_trigger()`,
        `CREATE TRIGGER catalog_refresh_categories_trigger
         AFTER UPDATE OR DELETE ON categories
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_category_trigger()`,
        `CREATE TRIGGER catalog_refresh_category_families_trigger
         AFTER UPDATE OR DELETE ON category_families
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_category_family_trigger()`,
        `CREATE TRIGGER catalog_refresh_attribute_definitions_trigger
         AFTER UPDATE OR DELETE ON category_attribute_definitions
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_attribute_definition_trigger()`,
        `CREATE TRIGGER catalog_refresh_attribute_options_trigger
         AFTER UPDATE OR DELETE ON category_attribute_options
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_attribute_option_trigger()`,
        `CREATE TRIGGER catalog_refresh_tenants_trigger
         AFTER UPDATE OR DELETE ON tenants
         FOR EACH ROW EXECUTE FUNCTION catalog_refresh_from_tenant_trigger()`,
      ]

      for (const statement of triggerStatements) {
        await db.rawQuery(statement)
      }

      await db.rawQuery(`
        DO $$
        DECLARE
          target record;
        BEGIN
          FOR target IN
            SELECT tenant_id, id
            FROM establishments
            WHERE published_revision_id IS NOT NULL
          LOOP
            PERFORM catalog_refresh_establishment(target.tenant_id, target.id);
          END LOOP;
        END;
        $$
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      const functions = [
        'catalog_refresh_from_tenant_trigger()',
        'catalog_refresh_from_attribute_option_trigger()',
        'catalog_refresh_from_attribute_definition_trigger()',
        'catalog_refresh_from_category_family_trigger()',
        'catalog_refresh_from_category_trigger()',
        'catalog_refresh_from_region_trigger()',
        'catalog_refresh_from_city_trigger()',
        'catalog_refresh_from_organization_trigger()',
        'catalog_refresh_from_file_trigger()',
        'catalog_refresh_from_media_asset_trigger()',
        'catalog_refresh_from_special_hour_trigger()',
        'catalog_refresh_from_attribute_option_selection_trigger()',
        'catalog_refresh_from_revision_child_trigger()',
        'catalog_refresh_from_revision_trigger()',
        'catalog_refresh_from_establishment_trigger()',
        'catalog_is_open_now(text, text, text, jsonb, jsonb, timestamptz)',
        'catalog_refresh_establishment(integer, integer)',
        'catalog_delete_establishment(integer, integer)',
        'catalog_bump_tenant_version(integer)',
        'catalog_prepare_search_document()',
        'catalog_normalize_text(text)',
      ]

      for (const name of functions) {
        await db.rawQuery(`DROP FUNCTION IF EXISTS ${name} CASCADE`)
      }
    })

    this.schema.dropTable('catalog_establishment_categories')
    this.schema.dropTable('catalog_establishments')
    this.schema.dropTable('catalog_tenant_versions')
  }
}
