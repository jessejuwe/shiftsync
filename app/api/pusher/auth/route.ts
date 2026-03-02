import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPusherServer } from "@/lib/pusher";

/**
 * Pusher private channel auth.
 * POST with socket_id and channel_name (form-urlencoded or JSON).
 * Validates access for:
 * - private-user-${userId}: only that user
 * - private-schedule-${locationId}: any authenticated user
 */
export async function POST(request: NextRequest) {
  let pusher;
  try {
    pusher = getPusherServer();
  } catch {
    return NextResponse.json(
      { error: "Pusher not configured" },
      { status: 503 }
    );
  }

  let body: { socket_id?: string; channel_name?: string };
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = {
        socket_id: formData.get("socket_id") as string | undefined,
        channel_name: formData.get("channel_name") as string | undefined,
      };
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { socket_id, channel_name } = body;
  if (!socket_id || !channel_name) {
    return NextResponse.json(
      { error: "socket_id and channel_name required" },
      { status: 400 }
    );
  }

  const session = await auth();

  // Private user channel: private-user-${userId} — only that user
  if (channel_name.startsWith("private-user-")) {
    const channelUserId = channel_name.replace("private-user-", "");
    if (!session?.user?.id || session.user.id !== channelUserId) {
      return NextResponse.json(
        { error: "Unauthorized to subscribe to this channel" },
        { status: 403 }
      );
    }
  }
  // Private schedule channel: private-schedule-${locationId} — any authenticated user
  else if (channel_name.startsWith("private-schedule-")) {
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized to subscribe to this channel" },
        { status: 403 }
      );
    }
  }
  // Unknown channel type — reject
  else {
    return NextResponse.json(
      { error: "Unknown channel type" },
      { status: 403 }
    );
  }

  try {
    const auth = pusher.authorizeChannel(socket_id, channel_name);
    return NextResponse.json(auth);
  } catch (err) {
    console.error("Pusher auth error:", err);
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 500 }
    );
  }
}
