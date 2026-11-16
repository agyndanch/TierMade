import { HttpError } from "@/lib/errors";
import { handle, json, requireApiUser } from "@/lib/http";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { profileSchema } from "@/lib/validation";
import { updateMyProfile } from "@/services/profiles";

/** multipart/form-data: name, bio, and optionally avatar (file) or removeAvatar=1. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Expected a form upload");
  }
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : undefined;
  };
  const fields = profileSchema.parse({ name: text("name") ?? "", bio: text("bio") });

  const file = form.get("avatar");
  let avatar: Buffer | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "That image is too large (1 MB max)");
    avatar = Buffer.from(await file.arrayBuffer());
  }

  await updateMyProfile(user.id, {
    name: fields.name,
    bio: fields.bio ?? null,
    avatar,
    removeAvatar: text("removeAvatar") === "1",
  });
  return json({ ok: true });
});
