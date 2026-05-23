import { filesize } from "filesize";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function formatBytes(bytes: number): string {
  return filesize(bytes, { standard: "jedec" }) as string;
}

export function formatDate(dateStr: string | Date): string {
  return format(new Date(dateStr), "dd MMM yyyy 'à' HH:mm", { locale: fr });
}
