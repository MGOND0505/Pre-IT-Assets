import axios, { type AxiosError } from "axios"

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  error: unknown
}

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001/api",
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<null>>) => {
    if (typeof window !== "undefined" && error.response?.status === 401) {
      const isAuthRoute = window.location.pathname.startsWith("/login")
      if (!isAuthRoute) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  }
)

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiEnvelope<null> | undefined
    return data?.message ?? fallback
  }
  return fallback
}
