import { processClientPortalUpload, uploadJsonResponse } from "@/lib/services/client-portal-upload";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return uploadJsonResponse({
        ok: false,
        status: 415,
        error: "This file type is not supported.",
        code: "UNSUPPORTED_FILE"
      });
    }

    const formData = await request.formData();
    const checklistItemId = String(formData.get("checklistItemId") || "").trim();
    const token = String(formData.get("token") || "").trim() || null;
    const files = formData.getAll("file").filter((value): value is File => value instanceof File);

    if (!checklistItemId) {
      return uploadJsonResponse({
        ok: false,
        status: 400,
        error: "This upload request is not available.",
        code: "INVALID_REQUEST"
      });
    }

    if (files.length > 1) {
      return uploadJsonResponse({
        ok: false,
        status: 400,
        error: "Please upload one document at a time.",
        code: "MULTIPLE_FILES"
      });
    }

    const file = files[0];
    if (!(file instanceof File)) {
      return uploadJsonResponse({
        ok: false,
        status: 400,
        error: "Please choose a file to upload.",
        code: "EMPTY_FILE"
      });
    }

    return uploadJsonResponse(
      await processClientPortalUpload({
        checklistItemId,
        file,
        token
      })
    );
  } catch {
    return uploadJsonResponse({
      ok: false,
      status: 500,
      error: "Upload failed. Please try again.",
      code: "UPLOAD_FAILED"
    });
  }
}
