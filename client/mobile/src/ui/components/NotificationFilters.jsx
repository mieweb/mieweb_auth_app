import React from "react";
import { Input, Select, Card, CardContent } from "@mieweb/ui";

const filterOptions = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approve", label: "Approved" },
  { value: "reject", label: "Rejected" },
];

export const NotificationFilters = ({
  filter,
  searchTerm,
  onFilterChange,
  onSearchChange,
}) => {
  return (
    <Card className="m-2">
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              hideLabel
            />
          </div>
          <div className="flex items-center">
            <Select
              options={filterOptions}
              value={filter}
              onValueChange={onFilterChange}
              hideLabel
              placeholder="Filter"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
