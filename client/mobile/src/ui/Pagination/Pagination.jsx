import React from "react";
import { Pagination as MiePagination } from "@mieweb/ui";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex justify-center">
      <MiePagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        size="sm"
        showFirstLast={false}
      />
    </div>
  );
};

export default Pagination;
