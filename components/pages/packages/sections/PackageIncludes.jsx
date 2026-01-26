import { Check, X } from "lucide-react";

export function PackageIncludes({ includes, notIncludes }) {
  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
      {/* What's Included */}
      {includes && includes.length > 0 && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-green-700">
            ✅ Qué Incluye
          </h2>
          <ul className="space-y-3">
            {includes.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 rounded-full bg-green-100 p-1">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What's NOT Included */}
      {notIncludes && notIncludes.length > 0 && (
        <div>
          <h2 className="mb-4 text-2xl font-bold text-red-700">
            ❌ No Incluye
          </h2>
          <ul className="space-y-3">
            {notIncludes.map((item, index) => (
              <li key={index} className="flex items-start gap-3">
                <div className="mt-1 flex-shrink-0 rounded-full bg-red-100 p-1">
                  <X className="h-4 w-4 text-red-600" />
                </div>
                <span className="text-gray-700">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
