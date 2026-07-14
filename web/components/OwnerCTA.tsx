export default function OwnerCTA() {
  return (
    <section className="bg-primary text-on-primary py-24 px-margin-mobile md:px-margin-desktop relative overflow-hidden">
      <div className="max-w-4xl mx-auto text-center relative z-10 flex flex-col items-center">
        <h2 className="font-display-lg text-headline-lg-mobile md:text-display-lg mb-6">
          Бажаєте здати житло?
        </h2>
        <p className="font-body-lg text-body-lg text-primary-fixed-dim mb-10 max-w-2xl">
          Знайдіть надійних орендарів швидко та без посередників. Опублікуйте своє оголошення на
          RentDirect абсолютно безкоштовно та керуйте процесом здачі самостійно.
        </p>
        <button className="bg-secondary text-on-secondary font-label-md text-label-md px-8 py-4 rounded-lg hover:bg-secondary-container hover:text-on-secondary-container transition-colors shadow-level-2 active:scale-95 flex items-center gap-2">
          Опублікувати оголошення безкоштовно <span className="material-symbols-outlined">add_home</span>
        </button>
      </div>
    </section>
  );
}
