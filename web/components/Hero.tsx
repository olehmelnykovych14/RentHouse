import CityInput from "./CityInput";

export default function Hero() {
  return (
    <section className="relative min-h-[600px] md:min-h-[760px] flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop py-24 bg-surface-container-low overflow-hidden">
      {/* Фонове зображення (плейсхолдер) */}
      <div className="absolute inset-0 z-0">
        <div
          className="bg-cover bg-center w-full h-full opacity-30"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuC0rHEpmNtb9CrUzujzqg80W-X3oE9GO6981aLk4Bt0Fgcv5UzD3b89kNHcohwUFY14IsfN9wMO2wvk5yryQkryLdYbUSfkO6FR7epM2QZULkG3aXnGTVa0i7jhcVJ8rIGQUZmj6qCxeW4h9pGWOmviYOryzwAHCQ3g6q0k3tPkWzTjjkQ8i3x5dnTSNJuge2T0aLYUK9CxIkqjNMVtKKstb_qOVw8VtnVPMybz0qNcwqvTqhT3oNBI')",
          }}
        />
      </div>

      <div className="relative z-10 text-center max-w-3xl mx-auto space-y-8">
        <h1 className="font-display-lg text-headline-lg-mobile md:text-display-lg text-on-surface">
          Знайдіть ідеальну квартиру прямо від власника
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
          Без комісій агентам. Прозорі умови. Прямий контакт.
        </p>

        {/* Пошук */}
        <form
          action="/listings"
          className="mt-8 bg-surface-container-lowest p-2 rounded-full shadow-level-3 flex flex-col md:flex-row items-center justify-between border border-outline-variant max-w-4xl mx-auto gap-2 md:gap-0"
        >
          <div className="flex items-center px-4 py-2 w-full md:w-auto flex-1 border-b md:border-b-0 md:border-r border-outline-variant/30">
            <CityInput name="q" />
          </div>
          <div className="flex items-center px-4 py-2 w-full md:w-auto flex-1 border-b md:border-b-0 md:border-r border-outline-variant/30">
            <span className="material-symbols-outlined text-outline mr-2">payments</span>
            <input
              name="price_max"
              className="w-full bg-transparent border-none focus:ring-0 text-body-md font-body-md placeholder-outline p-0"
              placeholder="Ціна до"
              type="text"
            />
          </div>
          <div className="flex items-center px-4 py-2 w-full md:w-auto flex-1">
            <span className="material-symbols-outlined text-outline mr-2">king_bed</span>
            <select
              name="rooms"
              className="w-full bg-transparent border-none focus:ring-0 text-body-md font-body-md text-on-surface-variant p-0 cursor-pointer"
              defaultValue=""
            >
              <option value="">Кімнати</option>
              <option value="1">1 кімната</option>
              <option value="2">2 кімнати</option>
              <option value="3+">3+ кімнат</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full md:w-auto bg-secondary text-on-secondary font-label-md text-label-md px-8 py-3 rounded-full hover:opacity-90 transition-opacity md:ml-2 flex items-center justify-center"
          >
            <span className="material-symbols-outlined mr-2">search</span> Знайти
          </button>
        </form>
      </div>
    </section>
  );
}
