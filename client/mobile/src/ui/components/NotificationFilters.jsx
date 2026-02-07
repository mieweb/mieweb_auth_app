import React from 'react';
import { Search, Filter } from 'lucide-react';

export const NotificationFilters = ({
  filter,
  searchTerm,
  onFilterChange,
  onSearchChange
}) => {
  return (

    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 p-4 m-2">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-600 dark:text-blue-400" />
            <input
              type="text"
              placeholder="Search requests..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <select
            className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium border-2 border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900 transition-all cursor-pointer"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approve">Approved</option>
            <option value="reject">Rejected</option>
          </select>
        </div>
      </div>
    </div>
  );
}; 