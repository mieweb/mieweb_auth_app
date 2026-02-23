import React from "react";
import { SimplePagination } from "@mieweb/ui";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center mt-4 w-full">
      <SimplePagination
        page={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        showPageInfo
      />
    </div>
  );
};

export default Pagination;
