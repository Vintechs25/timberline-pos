/**
 * Reusable export menu — CSV / Excel / PDF for any list page.
 */
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, FileType } from "lucide-react";
import { exportRows, type Row } from "@/lib/bulk-io";

interface Props {
  filename: string;
  title?: string;
  columns: { key: string; label: string }[];
  rows: Row[];
  disabled?: boolean;
}

export function ExportMenu({ filename, title, columns, rows, disabled }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !rows.length}>
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => exportRows("csv", { filename, columns, rows, title })}>
          <FileText className="h-4 w-4 mr-2" /> CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportRows("xlsx", { filename, columns, rows, title })}>
          <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportRows("pdf", { filename, columns, rows, title })}>
          <FileType className="h-4 w-4 mr-2" /> PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
