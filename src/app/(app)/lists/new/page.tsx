import { isCategoryId } from "@/catalog/categories";
import { NewListForm } from "./new-list-form";

export const metadata = { title: "New list" };

export default async function NewListPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { category } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">New list</h1>
      <NewListForm initialCategory={isCategoryId(category) ? category : undefined} />
    </div>
  );
}
