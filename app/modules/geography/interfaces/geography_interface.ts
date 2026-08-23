namespace IGeography {
  export interface RegionPayload {
    name: string
    slug?: string
    description?: string | null
    sort_order?: number
    is_active?: boolean
  }

  export interface RegionUpdatePayload {
    name?: string
    slug?: string
    description?: string | null
    sort_order?: number
    is_active?: boolean
  }

  export interface CityPayload {
    region_id: number
    name: string
    slug?: string
    state_code: string
    country_code?: string
    ibge_code?: string | null
    timezone?: string
    latitude?: number | null
    longitude?: number | null
    sort_order?: number
    is_active?: boolean
  }

  export interface CityUpdatePayload {
    region_id?: number
    name?: string
    slug?: string
    state_code?: string
    country_code?: string
    ibge_code?: string | null
    timezone?: string
    latitude?: number | null
    longitude?: number | null
    sort_order?: number
    is_active?: boolean
  }
}

export default IGeography
