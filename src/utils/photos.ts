export function getPhotoUrls(
  L_Photos: unknown
): string[] {
  if (!L_Photos) {
    return [];
  }

  try {
    const parsed =
      typeof L_Photos === "string"
        ? JSON.parse(L_Photos)
        : L_Photos;

    if (
      !Array.isArray(parsed) ||
      parsed.length === 0
    ) {
      return [];
    }

    return parsed
      .map((item): string | null => {
        if (typeof item === "string") {
          return item.trim();
        }

        if (
          typeof item === "object" &&
          item !== null
        ) {
          const media =
            item as Record<string, unknown>;

          const url =
            media.url ??
            media.href ??
            media.photoUrl;

          return typeof url === "string"
            ? url.trim()
            : null;
        }

        return null;
      })
      .filter(
        (url): url is string => {
          if (!url) {
            return false;
          }

          if (
            !/^https?:\/\//i.test(url)
          ) {
            return false;
          }

          // Reject document/media types we do not want.
          if (
            /\.(pdf|doc|docx|txt)(?:$|\?)/i.test(
              url
            )
          ) {
            return false;
          }

          // Keep known MLS/Trestle image URLs.
          return (
            /PHOTO-Jpeg/i.test(url) ||
            /PHOTO/i.test(url) ||
            /\.(?:jpg|jpeg|png|webp)(?:$|\?)/i.test(
              url
            )
          );
        }
      );
  } catch {
    return [];
  }
}

export function getFirstPhotoUrl(
  L_Photos: unknown
): string {
  const photos =
    getPhotoUrls(L_Photos);

  return photos[0] ?? "";
}

/**
 * Check whether the remote media URL is actually
 * available and appears to be an image.
 *
 * Some MLS/Trestle URLs look like valid PHOTO URLs
 * but return 404 "Media record not found".
 */
export async function isValidPhotoUrl(
  url: string
): Promise<boolean> {
  try {
    const response =
      await fetch(url, {
        method: "HEAD",
        redirect: "follow",
      });

    if (!response.ok) {
      return false;
    }

    const contentType =
      response.headers.get(
        "content-type"
      );

    return Boolean(
      contentType &&
      contentType.toLowerCase().startsWith("image/")
    );
  } catch {
    return false;
  }
}