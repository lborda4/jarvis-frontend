import { apiClient } from './apiClient'
import {
  cachedQuery,
  companyQueryKey,
  invalidateQueryCache,
  QUERY_STALE_MS,
} from './queryCache'

const PRODUCTS_ENDPOINT = '/products'
const PRODUCT_CATEGORIES_ENDPOINT = '/products/categories'

const PRODUCT_CATEGORIES_CACHE_KEY = ['products', 'categories']

export interface ProductCategoryResponse {
  id: string
  name: string
}

export interface ProductCategoriesListResponse {
  items: ProductCategoryResponse[]
  total: number
}

export interface ProductPriceListInput {
  position: number
  name: string
  price: number
  enabled: boolean
}

export interface CreateProductRequest {
  sku: string
  name: string
  kind: 'product' | 'service'
  unit: string
  categoryId?: string | null
  description?: string | null
  /** Ids de jarvis_taxes (Impuestos y retenciones) elegidos para el producto. */
  taxIds?: string[]
  /** Si el precio de venta cargado ya incluye el IVA. */
  priceIncludesIva?: boolean
  priceLists: ProductPriceListInput[]
}

export interface ProductTax {
  id: string
  code: string
  name: string
  tax_type: string
  rate: number | null
}

export interface ProductResponse {
  id: string
  sku: string
  name: string
  kind: string
  unit: string
  categoryId: string | null
  categoryName: string | null
  description: string | null
  taxes: ProductTax[]
  priceIncludesIva: boolean
  priceLists: Array<{
    id: string
    position: number
    name: string
    price: number
    enabled: boolean
  }>
}

export interface CreateProductResponse {
  success: boolean
  product: ProductResponse
}

export interface ProductsListResponse {
  items: ProductResponse[]
  total: number
}

export async function fetchProducts(
  search?: string,
): Promise<ProductsListResponse> {
  const trimmedSearch = search?.trim()

  // Las búsquedas tipeadas no se cachean; la lista completa sí.
  if (trimmedSearch) {
    const { data } = await apiClient.get<ProductsListResponse>(
      PRODUCTS_ENDPOINT,
      { params: { search: trimmedSearch } },
    )
    return data
  }

  return cachedQuery(
    companyQueryKey(['products', 'list']),
    QUERY_STALE_MS.catalogs,
    async () => {
      const { data } = await apiClient.get<ProductsListResponse>(
        PRODUCTS_ENDPOINT,
      )
      return data
    },
  )
}

export async function fetchNextSku(
  kind: 'product' | 'service',
): Promise<string> {
  const { data } = await apiClient.get<{ sku: string }>(
    `${PRODUCTS_ENDPOINT}/next-sku`,
    { params: { kind } },
  )
  return data.sku
}

export interface UnitMeasure {
  code: string
  name: string
}

interface UnitMeasuresListResponse {
  items: UnitMeasure[]
  total: number
}

/** Unidades de medida DIAN (tabla maestra de NextPyme). Es un catálogo grande
 * (~1093 filas) y estable, así que se cachea por empresa. */
export async function fetchUnitMeasures(): Promise<UnitMeasure[]> {
  const response = await cachedQuery(
    companyQueryKey(['products', 'unit-measures']),
    QUERY_STALE_MS.catalogs,
    async () => {
      const { data } = await apiClient.get<UnitMeasuresListResponse>(
        `${PRODUCTS_ENDPOINT}/unit-measures`,
      )
      return data
    },
  )

  return response.items
}

export async function fetchProductCategories(): Promise<ProductCategoryResponse[]> {
  const response = await cachedQuery(
    companyQueryKey(PRODUCT_CATEGORIES_CACHE_KEY),
    QUERY_STALE_MS.catalogs,
    async () => {
      const { data } = await apiClient.get<ProductCategoriesListResponse>(
        PRODUCT_CATEGORIES_ENDPOINT,
      )
      return data
    },
  )

  return response.items
}

export async function createProductCategory(
  name: string,
): Promise<ProductCategoryResponse> {
  const { data } = await apiClient.post<ProductCategoryResponse>(
    PRODUCT_CATEGORIES_ENDPOINT,
    { name },
  )

  invalidateQueryCache(companyQueryKey(PRODUCT_CATEGORIES_CACHE_KEY))

  return data
}

export async function updateProductCategory(
  id: string,
  name: string,
): Promise<ProductCategoryResponse> {
  const { data } = await apiClient.put<ProductCategoryResponse>(
    `${PRODUCT_CATEGORIES_ENDPOINT}/${id}`,
    { name },
  )

  invalidateQueryCache(companyQueryKey(PRODUCT_CATEGORIES_CACHE_KEY))

  return data
}

export async function createProduct(
  request: CreateProductRequest,
): Promise<CreateProductResponse> {
  const { data } = await apiClient.post<CreateProductResponse>(
    PRODUCTS_ENDPOINT,
    request,
  )

  invalidateQueryCache(companyQueryKey(['products', 'list']))

  return data
}
