import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { MarkdownContent } from "@/components/MarkdownContent";

const docSlugs = [
  "introduction",
  "architecture",
  "format-specification",
  "instrument-intent-spec",
  "compiler-guide",
  "runtime-guide",
  "api-reference",
  "examples",
];

async function getDocContent(slug: string) {
  try {
    const filePath = join(process.cwd(), "../../docs", `${slug}.md`);
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch {
    return null;
  }
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!docSlugs.includes(slug)) {
    notFound();
  }

  const content = await getDocContent(slug);
  if (!content) {
    notFound();
  }

  return <MarkdownContent content={content} />;
}

export async function generateStaticParams() {
  return docSlugs.map((slug) => ({ slug }));
}
