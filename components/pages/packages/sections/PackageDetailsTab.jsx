"use client";

import { useState } from "react";
import { PackageItinerary } from "./PackageItinerary";
import { PackageIncludes } from "./PackageIncludes";

export function PackageDetailsTab({ packageData }) {
  const [activeTab, setActiveTab] = useState("itinerary");
  const details = packageData.details || {};

  const tabs = [
    { id: "itinerary", label: "Itinerario", show: details.itinerary?.length > 0 },
    { id: "includes", label: "Incluye/No Incluye", show: true },
    { id: "details", label: "Detalles", show: packageData.description },
  ].filter(tab => tab.show);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-primary text-primary"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "itinerary" && details.itinerary && (
          <PackageItinerary itinerary={details.itinerary} />
        )}

        {activeTab === "includes" && (
          <PackageIncludes
            includes={details.includes}
            notIncludes={details.not_includes}
          />
        )}

        {activeTab === "details" && packageData.description && (
          <div className="prose max-w-none">
            <p className="whitespace-pre-line text-gray-700">
              {packageData.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
