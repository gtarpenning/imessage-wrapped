import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  // GitHub automatically redirects /releases/latest/download/<asset-name> to the actual latest release
  // We use a pattern that matches any version number
  const githubRepo = "gtarpenning/imessage-wrapped";

  try {
    // Get the latest release info from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "iMessage-Wrapped-Download",
        },
        cache: "no-store", // Always fetch fresh data
      },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch latest release");
    }

    const release = await response.json();

    // Find the DMG asset
    const dmgAsset = release.assets.find((asset) =>
      asset.name.endsWith(".dmg"),
    );

    if (dmgAsset) {
      // Redirect to the browser download URL
      const redirectResponse = NextResponse.redirect(dmgAsset.browser_download_url, 307);
      redirectResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      redirectResponse.headers.set("Pragma", "no-cache");
      redirectResponse.headers.set("Expires", "0");
      return redirectResponse;
    }

    // Fallback: try the generic latest pattern
    return NextResponse.redirect(
      `https://github.com/${githubRepo}/releases/latest`,
      307,
    );
  } catch (error) {
    console.error("Error fetching release:", error);

    // Fallback to GitHub releases page
    return NextResponse.redirect(
      `https://github.com/${githubRepo}/releases/latest`,
      307,
    );
  }
}
