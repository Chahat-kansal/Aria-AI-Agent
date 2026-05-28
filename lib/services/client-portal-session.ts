import crypto from "crypto";
import { cookies } from "next/headers";
import { sendClientWorkflowEmail } from "@/lib/services/email";
import { getEmailConfigStatus } from "@/lib/services/runtime-config";
import {
  buildClientLink,
  ensureClientPortalToken,
  getClientPortalById,
  getClientPortalByToken
} from "@/lib/services/client-workflows";

const CLIENT_PORTAL_SESSION_COOKIE = "aria_client_portal_session";
const CLIENT_PORTAL_SESSION_DAYS = 14;

type ClientPortalSessionPayload = {
  portalId: string;
  clientId: string;
  workspaceId: string;
  matterId: string | null;
  exp: number;
};

function sessionSecret() {
  const secret = process.env.CLIENT_PORTAL_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Missing CLIENT_PORTAL_SESSION_SECRET or NEXTAUTH_SECRET for client portal session signing.");
  return secret;
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodePayload(payload: ClientPortalSessionPayload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signPayload(body)}`;
}

function decodePayload(value: string): ClientPortalSessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  if (signPayload(body) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ClientPortalSessionPayload;
    if (!parsed.portalId || !parsed.clientId || !parsed.workspaceId || !parsed.exp) return null;
    if (parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function maskPortalLink(url: string) {
  const lastSlash = url.lastIndexOf("/");
  if (lastSlash === -1) return url;
  const token = url.slice(lastSlash + 1);
  if (token.length < 10) return `${url.slice(0, lastSlash + 1)}****`;
  return `${url.slice(0, lastSlash + 1)}${token.slice(0, 6)}******${token.slice(-4)}`;
}

export async function setClientPortalSessionFromToken(token: string) {
  const portal = await getClientPortalByToken(token);
  if (!portal) return null;
  const payload: ClientPortalSessionPayload = {
    portalId: portal.id,
    clientId: portal.clientId,
    workspaceId: portal.workspaceId,
    matterId: portal.matterId ?? null,
    exp: Date.now() + CLIENT_PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000
  };
  cookies().set(CLIENT_PORTAL_SESSION_COOKIE, encodePayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/client",
    expires: new Date(payload.exp)
  });
  return portal;
}

export async function clearClientPortalSession() {
  cookies().set(CLIENT_PORTAL_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/client",
    expires: new Date(0)
  });
}

export async function getClientPortalSession() {
  const cookieValue = cookies().get(CLIENT_PORTAL_SESSION_COOKIE)?.value;
  if (!cookieValue) return null;
  const payload = decodePayload(cookieValue);
  if (!payload) {
    await clearClientPortalSession();
    return null;
  }
  const portal = await getClientPortalById(payload.portalId);
  if (!portal || portal.clientId !== payload.clientId || portal.workspaceId !== payload.workspaceId || (payload.matterId ?? null) !== (portal.matterId ?? null)) {
    await clearClientPortalSession();
    return null;
  }
  return portal;
}

export async function requestClientPortalLoginLink(input: { email: string; requestOrigin?: string | null }) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const generic = {
    delivered: false,
    reason: "If that email matches an active client portal, a secure sign-in link will be sent.",
    emailConfigured: getEmailConfigStatus().configured
  };
  if (!normalizedEmail) return generic;

  const { prisma } = await import("@/lib/prisma");
  const client = await prisma.client.findFirst({
    where: { email: normalizedEmail, archivedAt: null },
    include: {
      matters: {
        where: { archivedAt: null },
        orderBy: { updatedAt: "desc" },
        take: 1
      }
    }
  });
  if (!client) return generic;

  const matter = client.matters[0];
  const invite = await ensureClientPortalToken({
    workspaceId: client.workspaceId,
    clientId: client.id,
    matterId: matter?.id ?? null,
    label: "Client portal sign-in",
    createdByUserId: matter?.assignedToUserId ?? null,
    requestOrigin: input.requestOrigin
  });
  const activationUrl = buildClientLink("/client/activate", invite.token, input.requestOrigin);
  const emailResult = await sendClientWorkflowEmail({
    to: client.email,
    recipientName: `${client.firstName} ${client.lastName}`.trim(),
    workspaceName: "Aria Client Portal",
    subject: "Your secure client portal sign-in link",
    intro: "Use this secure link to access your client portal.",
    actionLabel: "Open client portal",
    actionLink: activationUrl,
    footer: "Your migration team will review all information before use."
  });
  return {
    delivered: emailResult.delivered,
    reason: emailResult.delivered ? "Secure sign-in link sent." : emailResult.reason,
    emailConfigured: getEmailConfigStatus().configured
  };
}
