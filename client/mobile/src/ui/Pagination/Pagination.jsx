import React from "react";
import { Button } from "@mieweb/ui";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="flex justify-center items-center mt-4 w-full">
      <Button
        variant="secondary"
        size="sm"
        onClick={handlePrev}
        disabled={currentPage === 1}
      >
        Prev
      </Button>
      <span className="px-2 text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleNext}
        disabled={currentPage === totalPages}
      >
        Next
      </Button>
    </div>
  );
};

export default Pagination;
