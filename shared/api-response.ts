// A disconnected rewrite proxy may return plain text or HTML instead of JSON.
// Never render that response body (or a raw JSON parser exception) in the UI.
export async function readApiResponse<T>(response: Response): Promise<T> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The API connection failed or returned an unreadable response. Check that both dev servers are running, then retry. Your notes are still here.",
    );
  }
  if (!response.ok) {
    const message =
      data !== null && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : undefined;
    throw new Error(
      typeof message === "string" && message.length > 0
        ? message
        : "Request failed. Please retry.",
    );
  }
  return data as T;
}
