import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MarkdownContent } from "@/components/MarkdownContent";

async function getDocContent(slug: string) {
  try {
    const filePath = join(process.cwd(), "../../docs", `${slug}.md`);
    const content = await readFile(filePath, "utf-8");
    return content;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const content = await getDocContent("introduction");

  if (!content) {
    return <div>Documentation not found</div>;
  }

  return <MarkdownContent content={content} />;
}
