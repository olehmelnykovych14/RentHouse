const COLS = [
  ["About Us", "Terms of Service"],
  ["Privacy Policy", "Contact Support"],
  ["Owner Resources", "Careers"],
];

export default function Footer() {
  return (
    <footer className="bg-surface-container-highest w-full mt-auto">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter py-12 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="col-span-1">
          <div className="font-display-lg text-headline-md font-bold text-primary mb-4">RentDirect</div>
          <p className="font-caption text-caption text-on-surface-variant">
            © 2024 RentDirect. Усі права захищено. Прямий маркетплейс оренди від власників.
          </p>
        </div>
        {COLS.map((col, i) => (
          <div key={i} className="flex flex-col gap-2">
            {col.map((label) => (
              <a
                key={label}
                href="#"
                className="font-body-md text-body-md text-on-surface-variant hover:text-primary underline transition-all hover:opacity-80"
              >
                {label}
              </a>
            ))}
          </div>
        ))}
      </div>
    </footer>
  );
}
