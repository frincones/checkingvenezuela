import { Calendar, MapPin, Utensils } from "lucide-react";

export function PackageItinerary({ itinerary }) {
  if (!itinerary || itinerary.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="mb-6 text-2xl font-bold">Itinerario Completo</h2>

      <div className="space-y-6">
        {itinerary.map((day, index) => (
          <div key={index} className="relative border-l-4 border-primary pl-8 pb-8 last:pb-0">
            {/* Day Badge */}
            <div className="absolute -left-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <span className="text-sm font-bold">{day.day}</span>
            </div>

            {/* Day Title */}
            <div className="mb-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="h-4 w-4" />
                <span>Día {day.day}</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900">{day.title}</h3>
            </div>

            {/* Activities */}
            {day.activities && day.activities.length > 0 && (
              <div className="mb-4">
                <ul className="space-y-2">
                  {day.activities.map((activity, actIndex) => (
                    <li key={actIndex} className="flex items-start gap-3">
                      <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />
                      <span className="text-gray-700">{activity}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Meals */}
            {day.meals && day.meals.length > 0 && (
              <div className="rounded-lg bg-primary/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <Utensils className="h-4 w-4" />
                  <span>Comidas Incluidas</span>
                </div>
                <ul className="flex flex-wrap gap-2">
                  {day.meals.map((meal, mealIndex) => (
                    <li
                      key={mealIndex}
                      className="rounded-full bg-white px-3 py-1 text-sm text-gray-700"
                    >
                      {meal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
