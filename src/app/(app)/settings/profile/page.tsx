import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { findProfileByUsername } from "@/repositories/users";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const user = await requireUser();
  const profile = await findProfileByUsername(user.username);
  if (!profile) notFound();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <Link
          href={`/u/${profile.username}`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Your profile
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Edit profile</h1>
      </div>
      <ProfileForm
        username={profile.username}
        initial={{ name: profile.name, bio: profile.bio ?? "", image: profile.image }}
      />
    </div>
  );
}
