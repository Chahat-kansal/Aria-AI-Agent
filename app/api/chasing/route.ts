import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentWorkspaceContext } from "@/lib/services/current-workspace";
import {
  previewClientChase,
  runClientChasingScheduler,
  saveClientChasingSettings,
  sendClientChase,
  upsertClientChasingPreference
} from "@/lib/services/chasing/client-chasing-service";

const settingsSchema = z.object({
  action: z.literal("save_settings"),
  enabled: z.boolean(),
  autoSendEnabled: z.boolean(),
  consentRequired: z.boolean(),
  frequencyHours: z.number().int().min(1).max(168),
  channels: z.object({
    portal: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
    push: z.boolean()
  }),
  quietHours: z.object({
    enabled: z.boolean(),
    start: z.string().nullable(),
    end: z.string().nullable(),
    timezone: z.string().nullable()
  }).optional()
});

const preferenceSchema = z.object({
  action: z.literal("save_preference"),
  clientId: z.string().min(1),
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  portalEnabled: z.boolean(),
  optedOutNonEssential: z.boolean()
});

const previewSchema = z.object({
  action: z.literal("preview"),
  sourceType: z.enum(["missing_documents", "pending_confirmation", "appointment", "unpaid_invoice", "unread_portal_message"]),
  sourceId: z.string().min(1),
  channel: z.enum(["portal", "email", "sms", "push"])
});

const sendSchema = z.object({
  action: z.literal("send"),
  sourceType: z.enum(["missing_documents", "pending_confirmation", "appointment", "unpaid_invoice", "unread_portal_message"]),
  sourceId: z.string().min(1),
  channel: z.enum(["portal", "email", "sms", "push"])
});

const runSchema = z.object({
  action: z.literal("run_check")
});

export async function POST(req: Request) {
  try {
    const context = await requireCurrentWorkspaceContext();
    const body = await req.json().catch(() => null);
    const requestOrigin = new URL(req.url).origin;

    const candidates = [
      settingsSchema.safeParse(body),
      preferenceSchema.safeParse(body),
      previewSchema.safeParse(body),
      sendSchema.safeParse(body),
      runSchema.safeParse(body)
    ];
    const parsed = candidates.find((candidate) => candidate.success);

    if (!parsed || !parsed.success) {
      return NextResponse.json({ error: "Valid client chasing details are required." }, { status: 400 });
    }

    if (parsed.data.action === "save_settings") {
      const result = await saveClientChasingSettings({
        workspaceId: context.workspace.id,
        user: context.user,
        enabled: parsed.data.enabled,
        autoSendEnabled: parsed.data.autoSendEnabled,
        consentRequired: parsed.data.consentRequired,
        frequencyHours: parsed.data.frequencyHours,
        channels: parsed.data.channels,
        quietHours: parsed.data.quietHours
      });
      return NextResponse.json({ ok: true, settings: result });
    }

    if (parsed.data.action === "save_preference") {
      const result = await upsertClientChasingPreference({
        workspaceId: context.workspace.id,
        user: context.user,
        clientId: parsed.data.clientId,
        emailEnabled: parsed.data.emailEnabled,
        smsEnabled: parsed.data.smsEnabled,
        pushEnabled: parsed.data.pushEnabled,
        portalEnabled: parsed.data.portalEnabled,
        optedOutNonEssential: parsed.data.optedOutNonEssential
      });
      return NextResponse.json({ ok: true, preference: result });
    }

    if (parsed.data.action === "preview") {
      const result = await previewClientChase({
        workspaceId: context.workspace.id,
        user: context.user,
        sourceType: parsed.data.sourceType,
        sourceId: parsed.data.sourceId,
        channel: parsed.data.channel,
        requestOrigin
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (parsed.data.action === "send") {
      const result = await sendClientChase({
        workspaceId: context.workspace.id,
        user: context.user,
        sourceType: parsed.data.sourceType,
        sourceId: parsed.data.sourceId,
        channel: parsed.data.channel,
        requestOrigin
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const result = await runClientChasingScheduler({
      workspaceId: context.workspace.id,
      user: context.user,
      requestOrigin
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "Authenticated workspace context is required.") {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (message === "CLIENT_CHASING_DENIED") {
      return NextResponse.json({ error: "You do not have permission to manage client chasing." }, { status: 403 });
    }
    if (message === "CLIENT_CHASE_NOT_FOUND") {
      return NextResponse.json({ error: "The pending reminder could not be found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Unable to complete the client chasing action right now." }, { status: 500 });
  }
}
