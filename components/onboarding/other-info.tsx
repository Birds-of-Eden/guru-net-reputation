// components/onboarding/other-info.tsx

"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Table as TableIcon,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import type { StepProps } from "@/types/onboarding";

// Excel-like data structure for a single sheet
type SheetData = {
  id: string; // Unique sheet identifier
  name: string; // Sheet name
  columns: string[]; // Column headers
  rows: string[][]; // 2D array of cell values
};

// Multiple sheets structure
type SpreadsheetData = SheetData[];

export function OtherInfo({
  formData,
  updateFormData,
  onNext,
  onPrevious,
}: StepProps) {
  // ---------- State ----------
  const [sheets, setSheets] = useState<SpreadsheetData>(() => {
    const saved = formData.otherField;
    if (saved && Array.isArray(saved) && saved.length > 0) {
      // Try to parse as new spreadsheet format (multiple sheets with id)
      if (saved[0] && typeof saved[0] === 'object' && 'id' in saved[0] && 'columns' in saved[0] && 'rows' in saved[0] && 'name' in saved[0]) {
        return saved as unknown as SpreadsheetData;
      }
      // Try to parse as old spreadsheet format (without id)
      if (saved[0] && typeof saved[0] === 'object' && 'columns' in saved[0] && 'rows' in saved[0] && 'name' in saved[0]) {
        // Add IDs to existing sheets
        return (saved as unknown as Omit<SheetData, 'id'>[]).map((sheet, idx) => ({
          ...sheet,
          id: `sheet_${Date.now()}_${idx}`,
        }));
      }
      // Convert old format to new format (single sheet)
      const columns = ["Category", "Title", "Data"];
      const rows = (saved as any[]).map((item: any) => [
        item.category || "",
        item.title || "",
        Array.isArray(item.data) ? item.data.join(", ") : (item.data || ""),
      ]);
      return [{ id: `sheet_${Date.now()}_0`, name: "Sheet 1", columns, rows }];
    }
    // Default empty spreadsheet with one sheet
    return [{
      id: `sheet_${Date.now()}_0`,
      name: "Sheet 1",
      columns: ["Field 1", "Field 2", "Field 3"],
      rows: [["", "", ""]],
    }];
  });

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const activeSheet = sheets[activeSheetIndex];

  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [showAddSheetDialog, setShowAddSheetDialog] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [editingSheetIndex, setEditingSheetIndex] = useState<number | null>(null);
  const columnInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Focus on column input when editing starts
  useEffect(() => {
    if (editingColumn !== null && columnInputRef.current) {
      columnInputRef.current.focus();
      columnInputRef.current.select();
    }
  }, [editingColumn]);

  // Handle paste from Excel
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, colIndex: number) => {
    e.preventDefault();
    
    const pastedText = e.clipboardData.getData('text');
    
    if (!pastedText) return;

    // Parse tab-separated values (Excel format)
    const rows = pastedText.split('\n').filter(row => row.trim() !== '');
    const parsedData = rows.map(row => row.split('\t').map(cell => cell.trim()));

    if (parsedData.length === 0) return;

    // Check if first row contains headers (all uppercase or mixed case)
    const firstRowHasHeaders = parsedData.length > 0 && parsedData[0].every(cell => 
      /^[A-Z_]+$/.test(cell) || /^[A-Za-z\s]+$/.test(cell)
    );

    let dataToPaste = parsedData;
    let newColumns = [...activeSheet.columns];

    // If first row looks like headers, use them as column names
    if (firstRowHasHeaders && parsedData.length > 1) {
      newColumns = parsedData[0];
      dataToPaste = parsedData.slice(1);
    }

    // Calculate max columns needed
    const maxCols = Math.max(
      ...dataToPaste.map(row => row.length),
      newColumns.length
    );

    // Update column headers if needed
    if (maxCols > newColumns.length) {
      for (let i = newColumns.length; i < maxCols; i++) {
        newColumns.push(`Field ${i + 1}`);
      }
    }

    // Update rows
    const newRows = [...activeSheet.rows];
    dataToPaste.forEach((pastedRow, i) => {
      const targetRowIndex = rowIndex + i;
      
      if (targetRowIndex < newRows.length) {
        // Update existing row
        newRows[targetRowIndex] = newRows[targetRowIndex].map((cell, c) => 
          c < pastedRow.length ? pastedRow[c] : cell
        );
        
        // Add extra columns if pasted data has more columns
        if (pastedRow.length > newRows[targetRowIndex].length) {
          for (let c = newRows[targetRowIndex].length; c < pastedRow.length; c++) {
            newRows[targetRowIndex].push(pastedRow[c]);
          }
        }
      } else {
        // Add new row
        const newRow = Array(newColumns.length).fill('');
        pastedRow.forEach((cell, c) => {
          if (c < newRow.length) {
            newRow[c] = cell;
          }
        });
        newRows.push(newRow);
      }
    });

    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex 
        ? { ...sheet, columns: newColumns, rows: newRows }
        : sheet
    ));
  };

  // ---------- Handlers ----------
  const handleNext = () => {
    // Save in new format with sheets containing id, name, columns, rows
    updateFormData({ otherField: sheets });
    onNext();
  };

  const handleAddSheet = () => {
    const newSheet: SheetData = {
      id: `sheet_${Date.now()}_${sheets.length}`,
      name: newSheetName || `Sheet ${sheets.length + 1}`,
      columns: ["Field 1", "Field 2", "Field 3"],
      rows: [["", "", ""]],
    };
    setSheets([...sheets, newSheet]);
    setActiveSheetIndex(sheets.length);
    setShowAddSheetDialog(false);
    setNewSheetName("");
  };

  const handleDeleteSheet = (index: number) => {
    if (sheets.length <= 1) return;
    const newSheets = sheets.filter((_, i) => i !== index);
    setSheets(newSheets);
    if (activeSheetIndex >= newSheets.length) {
      setActiveSheetIndex(newSheets.length - 1);
    } else if (activeSheetIndex === index) {
      setActiveSheetIndex(0);
    }
  };

  const handleRenameSheet = (index: number, newName: string) => {
    setSheets(prev => prev.map((sheet, idx) =>
      idx === index ? { ...sheet, name: newName } : sheet
    ));
    setEditingSheetIndex(null);
  };

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? {
            ...sheet,
            rows: sheet.rows.map((row, r) =>
              r === rowIndex
                ? row.map((cell, c) => (c === colIndex ? value : cell))
                : row
            ),
          }
        : sheet
    ));
  };

  const handleAddRow = () => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? { ...sheet, rows: [...sheet.rows, Array(sheet.columns.length).fill("")] }
        : sheet
    ));
  };

  const handleDeleteRow = (rowIndex: number) => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? { ...sheet, rows: sheet.rows.filter((_, i) => i !== rowIndex) }
        : sheet
    ));
  };

  const handleAddColumn = () => {
    const newColumnName = `Field ${activeSheet.columns.length + 1}`;
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? {
            ...sheet,
            columns: [...sheet.columns, newColumnName],
            rows: sheet.rows.map((row) => [...row, ""]),
          }
        : sheet
    ));
  };

  const handleDeleteColumn = (colIndex: number) => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? {
            ...sheet,
            columns: sheet.columns.filter((_, i) => i !== colIndex),
            rows: sheet.rows.map((row) => row.filter((_, i) => i !== colIndex)),
          }
        : sheet
    ));
  };

  const handleColumnRename = (colIndex: number, newName: string) => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? {
            ...sheet,
            columns: sheet.columns.map((col, i) => (i === colIndex ? newName : col)),
          }
        : sheet
    ));
    setEditingColumn(null);
  };

  const handleMoveColumn = (colIndex: number, direction: "up" | "down") => {
    if (
      (direction === "up" && colIndex === 0) ||
      (direction === "down" && colIndex === activeSheet.columns.length - 1)
    ) {
      return;
    }

    setSheets(prev => prev.map((sheet, idx) => {
      if (idx !== activeSheetIndex) return sheet;
      
      const newColIndex = direction === "up" ? colIndex - 1 : colIndex + 1;
      const newColumns = [...sheet.columns];
      [newColumns[colIndex], newColumns[newColIndex]] = [
        newColumns[newColIndex],
        newColumns[colIndex],
      ];

      const newRows = sheet.rows.map((row) => {
        const newRow = [...row];
        [newRow[colIndex], newRow[newColIndex]] = [newRow[newColIndex], newRow[colIndex]];
        return newRow;
      });

      return { ...sheet, columns: newColumns, rows: newRows };
    }));
  };

  // Keyboard navigation
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Move to next row
      const nextRow = rowIndex + 1;
      if (nextRow < activeSheet.rows.length) {
        setSelectedCell({ row: nextRow, col: colIndex });
        setTimeout(() => {
          const input = document.getElementById(`cell-${nextRow}-${colIndex}`);
          input?.focus();
        }, 0);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Move to next column
      const nextCol = colIndex + 1;
      if (nextCol < activeSheet.columns.length) {
        setSelectedCell({ row: rowIndex, col: nextCol });
        setTimeout(() => {
          const input = document.getElementById(`cell-${rowIndex}-${nextCol}`);
          input?.focus();
        }, 0);
      }
    }
  };

  // ---------- UI ----------
  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 shadow-lg ring-1 ring-black/5">
          <TableIcon className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          Data Spreadsheet
        </h1>
        <p className="mx-auto max-w-2xl text-balance text-sm text-gray-600">
          Add and manage your data in an Excel-like spreadsheet. Add columns,
          rows, and edit cells directly.
        </p>
      </div>

      {/* Main Card */}
      <Card className="border-0 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.15)] ring-1 ring-black/5 backdrop-blur bg-white">
        <CardContent className="p-6 md:p-8">
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleAddRow}
              size="sm"
              className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
            <Button
              type="button"
              onClick={handleAddColumn}
              size="sm"
              variant="outline"
              className="rounded-lg border-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Column
            </Button>
            <Button
              type="button"
              onClick={() => setShowAddSheetDialog(true)}
              size="sm"
              variant="outline"
              className="rounded-lg border-2 border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <FileText className="mr-2 h-4 w-4" />
              Add Sheet
            </Button>
            <div className="flex-1" />
            <span className="text-xs text-gray-500">
              {activeSheet.rows.length} rows × {activeSheet.columns.length} columns
            </span>
          </div>

          {/* Sheet Tabs */}
          <div className="mb-4 flex items-center gap-2 border-b border-gray-200 pb-2">
            {sheets.map((sheet, index) => (
              <div
                key={index}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-sm font-medium cursor-pointer transition-colors ${
                  index === activeSheetIndex
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-300 border-b-0"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200 border-b-0"
                }`}
                onClick={() => setActiveSheetIndex(index)}
              >
                {editingSheetIndex === index ? (
                  <Input
                    defaultValue={sheet.name}
                    onBlur={(e) => handleRenameSheet(index, (e.target as HTMLInputElement).value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleRenameSheet(index, (e.target as HTMLInputElement).value);
                      } else if (e.key === "Escape") {
                        setEditingSheetIndex(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="h-6 text-xs px-1 py-0 w-24"
                    autoFocus
                  />
                ) : (
                  <span 
                    className="truncate max-w-[120px]" 
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setEditingSheetIndex(index);
                    }}
                    title="Double-click to rename"
                  >
                    {sheet.name}
                  </span>
                )}
                {sheets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-4 w-4 text-gray-400 hover:text-red-600 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSheet(index);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {/* Spreadsheet */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b-2 border-gray-200">
                  <th className="w-12 px-3 py-2 text-xs font-medium text-gray-500 border-r border-gray-200">
                    #
                  </th>
                  {activeSheet.columns.map((col, colIndex) => (
                    <th
                      key={colIndex}
                      className="min-w-[150px] px-3 py-2 text-xs font-medium text-gray-700 border-r border-gray-200 relative group"
                    >
                      <div className="flex items-center gap-1">
                        {editingColumn === colIndex ? (
                          <Input
                            ref={columnInputRef}
                            defaultValue={col}
                            onBlur={(e) =>
                              handleColumnRename(colIndex, (e.target as HTMLInputElement).value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleColumnRename(colIndex, (e.target as HTMLInputElement).value);
                              } else if (e.key === "Escape") {
                                setEditingColumn(null);
                              }
                            }}
                            className="h-6 text-xs px-2 py-1"
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() => setEditingColumn(colIndex)}
                            className="cursor-pointer hover:text-emerald-600 truncate"
                            title="Click to rename"
                          >
                            {col}
                          </span>
                        )}
                        <div className="hidden group-hover:flex items-center gap-0.5 ml-auto">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-gray-400 hover:text-gray-600"
                            onClick={() => handleMoveColumn(colIndex, "up")}
                            disabled={colIndex === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-gray-400 hover:text-gray-600"
                            onClick={() => handleMoveColumn(colIndex, "down")}
                            disabled={colIndex === activeSheet.columns.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-red-400 hover:text-red-600"
                            onClick={() => handleDeleteColumn(colIndex)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </th>
                  ))}
                  <th className="w-12 px-3 py-2 border-l border-gray-200" />
                </tr>
              </thead>
              <tbody>
                {activeSheet.rows.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-2 text-xs text-gray-400 border-r border-gray-200 text-center">
                      {rowIndex + 1}
                    </td>
                    {row.map((cell, colIndex) => (
                      <td
                        key={colIndex}
                        className="border-r border-gray-200 px-1 py-1"
                      >
                        <Input
                          id={`cell-${rowIndex}-${colIndex}`}
                          value={cell}
                          onChange={(e) =>
                            handleCellChange(rowIndex, colIndex, e.target.value)
                          }
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          onPaste={(e) => handlePaste(e, rowIndex, colIndex)}
                          className="h-8 text-sm border-0 focus:ring-1 focus:ring-emerald-500 bg-transparent"
                          placeholder="..."
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1 border-l border-gray-200 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDeleteRow(rowIndex)}
                        disabled={activeSheet.rows.length <= 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {activeSheet.rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
              <p className="text-sm text-gray-600">
                No data yet. Click{" "}
                <span className="font-medium text-gray-900">Add Row</span> to get
                started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer Navigation */}
      <div className="flex flex-col gap-3 pt-2 md:flex-row md:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          className="h-12 rounded-xl border-2 transition-all hover:bg-linear-to-r hover:from-emerald-50 hover:to-teal-50 hover:text-emerald-700 hover:shadow-sm"
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 17l-5-5m0 0l5-5m-5 5h12"
            />
          </svg>
          Previous
        </Button>

        <Button
          type="button"
          onClick={handleNext}
          className="h-12 rounded-xl bg-gray-900 text-white shadow-lg transition-all hover:-translate-y-px hover:bg-black hover:shadow-xl"
        >
          Continue to Next Step
          <svg
            className="ml-2 inline-block h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Button>
      </div>

      {/* Add Sheet Dialog */}
      {showAddSheetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Add New Sheet</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sheet Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Enter sheet name..."
                    value={newSheetName}
                    onChange={(e) => setNewSheetName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddSheetDialog(false);
                      setNewSheetName("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleAddSheet}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Create Sheet
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
