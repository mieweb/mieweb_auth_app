import React from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@mieweb/ui";

export const NotificationFilters = ({
  filter,
  searchTerm,
  onFilterChange,
  onSearchChange,
}) => {
  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-2xl shadow-lg p-4 m-2">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search requests..."
              className="pl-10 rounded-lg"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="bg-transparent text-muted-foreground border border-input rounded-lg px-3 py-2"
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
