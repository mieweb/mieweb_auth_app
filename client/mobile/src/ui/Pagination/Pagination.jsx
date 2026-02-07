import React from "react";

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="flex justify-center items-center mt-6 w-full gap-3">
      <button
        onClick={handlePrev}
        disabled={currentPage === 1}
        className="px-5 py-2.5 font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl disabled:bg-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-700 transition-all shadow-md hover:shadow-lg active:scale-98"
      >
        Previous
      </button>
      <span className="px-4 py-2 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white font-semibold">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="px-5 py-2.5 font-semibold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl disabled:bg-gray-400 disabled:cursor-not-allowed dark:disabled:bg-gray-700 transition-all shadow-md hover:shadow-lg active:scale-98"
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
