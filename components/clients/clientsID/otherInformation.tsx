// components/clients/OtherInformation.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  Trash2,
  Table as TableIcon,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Save,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface OtherInformationProps {
  clientData: {
    id: string;
    otherField?: any;
  };
  onRefreshClient?: () => Promise<any> | void;
  onRegisterCheck?: (checkFn: () => boolean, handleNavFn: (callback: () => void) => void) => void;
}

// Excel-like data structure for a single sheet
type SheetData = {
  id: string; // Unique sheet identifier
  name: string; // Sheet name
  columns: string[]; // Column headers
  rows: string[][]; // 2D array of cell values
};

// Multiple sheets structure
type SpreadsheetData = SheetData[];

export function OtherInformation({ clientData, onRefreshClient, onRegisterCheck }: OtherInformationProps) {
  const parseOtherField = (saved: any): SpreadsheetData => {
    if (saved && Array.isArray(saved) && saved.length > 0) {
      if (
        saved[0] &&
        typeof saved[0] === "object" &&
        "id" in saved[0] &&
        "columns" in saved[0] &&
        "rows" in saved[0] &&
        "name" in saved[0]
      ) {
        return saved as unknown as SpreadsheetData;
      }

      if (
        saved[0] &&
        typeof saved[0] === "object" &&
        "columns" in saved[0] &&
        "rows" in saved[0] &&
        "name" in saved[0]
      ) {
        return (saved as unknown as Omit<SheetData, "id">[]).map((sheet, idx) => ({
          ...sheet,
          id: `sheet_${Date.now()}_${idx}`,
        }));
      }

      const columns = ["Category", "Title", "Data"];
      const rows = (saved as any[]).map((item: any) => [
        item.category || "",
        item.title || "",
        Array.isArray(item.data) ? item.data.join(", ") : item.data || "",
      ]);
      return [{ id: `sheet_${Date.now()}_0`, name: "Sheet 1", columns, rows }];
    }

    return [
      {
        id: `sheet_${Date.now()}_0`,
        name: "Sheet 1",
        columns: ["Field 1", "Field 2", "Field 3"],
        rows: [["", "", ""]],
      },
    ];
  };

  // ---------- State ----------
  const [sheets, setSheets] = useState<SpreadsheetData>(() =>
    parseOtherField(clientData.otherField),
  );

  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const activeSheet = sheets[activeSheetIndex];
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const [showAddSheetDialog, setShowAddSheetDialog] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");
  const [editingSheetIndex, setEditingSheetIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteSheetDialog, setShowDeleteSheetDialog] = useState(false);
  const [sheetToDeleteIndex, setSheetToDeleteIndex] = useState<number | null>(null);
  const [deleteWarningStep, setDeleteWarningStep] = useState(1);
  const columnInputRef = useRef<HTMLInputElement>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  useEffect(() => {
    setSheets(parseOtherField(clientData.otherField));
    setActiveSheetIndex(0);
    setHasUnsavedChanges(false);
  }, [clientData.id, clientData.otherField]);

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
    setHasUnsavedChanges(true);
  };

  // ---------- Handlers ----------
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save in new format with sheets containing id, name, columns, rows
      const response = await fetch(`/api/clients/${clientData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otherField: sheets }),
      });

      if (response.ok) {
        toast.success("Other information saved successfully");
        setHasUnsavedChanges(false);
        if (onRefreshClient) {
          await onRefreshClient();
        }
      } else {
        toast.error("Failed to save other information");
      }
    } catch (error) {
      console.error("Error saving other information:", error);
      toast.error("Failed to save other information");
    } finally {
      setIsSaving(false);
    }
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
    setHasUnsavedChanges(true);
  };

  const handleDeleteSheet = (index: number) => {
    if (sheets.length <= 1) return;
    setSheetToDeleteIndex(index);
    setDeleteWarningStep(1);
    setShowDeleteSheetDialog(true);
  };

  const confirmDeleteSheet = () => {
    if (sheetToDeleteIndex === null) return;
    const newSheets = sheets.filter((_, i) => i !== sheetToDeleteIndex);
    setSheets(newSheets);
    if (activeSheetIndex >= newSheets.length) {
      setActiveSheetIndex(newSheets.length - 1);
    } else if (activeSheetIndex === sheetToDeleteIndex) {
      setActiveSheetIndex(0);
    }
    setShowDeleteSheetDialog(false);
    setSheetToDeleteIndex(null);
    setDeleteWarningStep(1);
    setHasUnsavedChanges(true);
  };

  const handleRenameSheet = (index: number, newName: string) => {
    setSheets(prev => prev.map((sheet, idx) =>
      idx === index ? { ...sheet, name: newName } : sheet
    ));
    setEditingSheetIndex(null);
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
  };

  const handleAddRow = () => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? { ...sheet, rows: [...sheet.rows, Array(sheet.columns.length).fill("")] }
        : sheet
    ));
    setHasUnsavedChanges(true);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setSheets(prev => prev.map((sheet, idx) => 
      idx === activeSheetIndex
        ? { ...sheet, rows: sheet.rows.filter((_, i) => i !== rowIndex) }
        : sheet
    ));
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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
    setHasUnsavedChanges(true);
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

  // Handle unsaved changes warning
  const handleBeforeNavigation = (callback: () => void) => {
    if (hasUnsavedChanges) {
      setPendingNavigation(() => callback);
      setShowUnsavedWarning(true);
    } else {
      callback();
    }
  };

  const handleStayAndSave = async () => {
    setShowUnsavedWarning(false);
    await handleSave();
    if (!hasUnsavedChanges && pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleDiscardChanges = () => {
    setShowUnsavedWarning(false);
    if (pendingNavigation) {
      pendingNavigation();
      setPendingNavigation(null);
    }
  };

  const handleCancelNavigation = () => {
    setShowUnsavedWarning(false);
    setPendingNavigation(null);
  };

  // Register check functions with parent
  useEffect(() => {
    if (onRegisterCheck) {
      onRegisterCheck(
        () => hasUnsavedChanges,
        handleBeforeNavigation
      );
    }
  }, [hasUnsavedChanges]);

  // ---------- UI ----------
  return (
    <Card className="shadow-lg border-0 bg-white dark:bg-slate-800">
      <CardHeader className="bg-linear-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20">
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <span>Other Information</span>
          </div>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-6">
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
        <div className="overflow-x-auto rounded-lg border border-gray-200 max-w-[1550px]">
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

      {/* Delete Sheet Confirmation Dialog */}
      {showDeleteSheetDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-white">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-red-600">
                {deleteWarningStep === 1 ? "Warning: Delete Sheet" : "Final Warning"}
              </h3>
              <div className="space-y-4">
                {deleteWarningStep === 1 ? (
                  <>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning 1 of 2:</strong> You are about to delete the sheet "{sheetToDeleteIndex !== null ? sheets[sheetToDeleteIndex].name : ''}".
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      This action cannot be undone. All data in this sheet will be permanently lost.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                      <p className="text-sm text-red-800">
                        <strong>Warning 2 of 2 (Final):</strong> Are you absolutely sure you want to delete "{sheetToDeleteIndex !== null ? sheets[sheetToDeleteIndex].name : ''}"?
                      </p>
                    </div>
                    <p className="text-sm text-gray-600">
                      This is your last chance to cancel. Once deleted, the data cannot be recovered.
                    </p>
                  </>
                )}
                <div className="flex gap-3 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowDeleteSheetDialog(false);
                      setSheetToDeleteIndex(null);
                      setDeleteWarningStep(1);
                    }}
                  >
                    Cancel
                  </Button>
                  {deleteWarningStep === 1 ? (
                    <Button
                      type="button"
                      onClick={() => setDeleteWarningStep(2)}
                      className="bg-yellow-600 text-white hover:bg-yellow-700"
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={confirmDeleteSheet}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete Sheet
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Unsaved Changes Warning Dialog */}
      {showUnsavedWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md bg-white">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Unsaved Changes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    You have unsaved changes in Other Information. If you navigate away without saving, all your changes will be lost.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelNavigation}
                >
                  Stay Here
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDiscardChanges}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  Discard Changes
                </Button>
                <Button
                  type="button"
                  onClick={handleStayAndSave}
                  disabled={isSaving}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSaving ? "Saving..." : "Save & Continue"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
