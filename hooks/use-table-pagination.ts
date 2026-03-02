"use client";

import { useState, useMemo, useEffect } from "react";

export function useTablePagination<T>(
  items: T[],
  pageSize: number,
  resetDeps: unknown[] = []
) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, resetDeps);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  return {
    currentPage,
    setCurrentPage,
    paginatedItems,
    totalPages,
    totalCount: items.length,
    showPagination: items.length > pageSize,
  };
}
