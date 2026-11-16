import { HttpError } from "@/lib/errors";
import { handle, json, requireApiUser } from "@/lib/http";
import { MAX_IMAGE_BYTES } from "@/lib/images";
import { customEntrySchema } from "@/lib/validation";
import { addCustomItemToList } from "@/services/lists";

type Ctx = { params: Promise<{ id: string }> };

/** multipart/form-data: title, creator?, tierId?, and either image (file) or imageUrl. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;

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
  const fields = customEntrySchema.parse({
    title: text("title") ?? "",
    creator: text("creator"),
    imageUrl: text("imageUrl"),
    tierId: text("tierId"),
  });

  const file = form.get("image");
  let image: Buffer | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "That image is too large (1 MB max)");
    image = Buffer.from(await file.arrayBuffer());
  }

  const entry = await addCustomItemToList(id, user.id, {
    title: fields.title,
    creator: fields.creator ?? null,
    tierId: fields.tierId ?? null,
    imageUrl: fields.imageUrl,
    image,
  });
  return json({ entry }, 201);
});
