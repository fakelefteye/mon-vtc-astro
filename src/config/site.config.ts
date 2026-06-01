// =============================================================
// FICHIER DE CONFIGURATION CENTRALE — ÉDITEZ CE FICHIER
// Toutes les informations personnelles/business sont ici.
// =============================================================

export const siteConfig = {

  // ----------------------------------------------------------
  // IDENTITÉ DU CHAUFFEUR
  // ----------------------------------------------------------
  driver: {
    firstName: "Sophie",
    lastName: "Martin",
    displayName: "Sophie",
    gender: "female" as "male" | "female",  // Accorde "chauffeur" / "chauffeure"
    languages: ["Français", "Anglais", "Espagnol"],
    licenseNumber: "VTC-2023-XXXXX",        // N° carte pro VTC
    photoUrl: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/driver-photo.jpg",
    bio: "Votre chauffeure privée à Grenoble et ses environs. Spécialisée dans les transferts vers les aéroports et les stations de ski des Alpes.",
    since: 2020,                             // Année de début d'activité
  },

  // ----------------------------------------------------------
  // ENTREPRISE / MARQUE
  // ----------------------------------------------------------
  company: {
    name: "ShipCars",
    legalName: "ShipCars",
    siren: "XXX XXX XXX",
    logoUrl: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/logo_ship_cars.png",
    faviconBaseUrl: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/favicon",
    tagline: "Votre service VTC premium",
    heroVideoUrl: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/nissan.mp4",
    heroTitle: "Votre Chauffeure Privée à Grenoble et Aéroport Lyon",
    heroSubtitle: "Voyages d'affaires, aéroport ou escapades dans les Alpes en véhicule 100% électrique.",
    aboutText: "Chauffeure VTC professionnelle basée à Grenoble, je mets à votre service mon expérience, ma discrétion et ma ponctualité pour tous vos déplacements.",
  },

  // ----------------------------------------------------------
  // LOCALISATION & ZONE DE SERVICE
  // ----------------------------------------------------------
  location: {
    city: "Grenoble",
    region: "Isère / Alpes",
    country: "FR",
    baseCoords: { lat: 45.188529, lng: 5.724524 },
    maxServiceRadiusKm: 150,
    autocompleteCountry: "fr",             // Code pays Google Maps autocomplete
  },

  // ----------------------------------------------------------
  // VÉHICULES (tableau — supporte plusieurs véhicules)
  // ----------------------------------------------------------
  vehicles: [
    {
      id: "nissan-leaf",
      name: "Nissan Leaf e+",
      model: "62 kWh",
      year: 2022,
      type: "Berline électrique" as const,
      electric: true,
      passengerCapacity: 4,
      luggageLiters: 435,
      isDefault: true,
      mainImageUrl: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/grenoble leaf.png",
      galleryImages: [
        {
          url: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/Nissan-Leaf-inside.jpg.webp",
          alt: "Intérieur Nissan Leaf — sièges arrière spacieux",
        },
        {
          url: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/nissan bagage.jpg",
          alt: "Coffre Nissan Leaf — 435 litres de capacité",
        },
        {
          url: "https://pub-d35dc23058ee46aca93fb6f682ad5e37.r2.dev/nissan fold.jpg",
          alt: "Sièges rabattables 60/40 Nissan Leaf",
        },
      ],
      features: [
        "100% électrique — zéro émission",
        "Sièges chauffants avant & arrière",
        "Coffre 435 L (sièges rabattables 60/40)",
        "5 étoiles Euro NCAP",
        "Conduite ultra-silencieuse",
        "Prises USB & chargement sans fil",
      ],
      certifications: ["Euro NCAP 5★"],
      description:
        "La Nissan Leaf e+ 62 kWh offre le parfait équilibre entre confort, sécurité et respect de l'environnement. Idéale pour vos transferts vers les aéroports et les stations de ski.",
    },
    // Pour ajouter un deuxième véhicule, décommentez et remplissez ce bloc :
    // {
    //   id: "mercedes-viano",
    //   name: "Mercedes-Benz Viano",
    //   model: "CDI",
    //   year: 2023,
    //   type: "Van",
    //   electric: false,
    //   passengerCapacity: 7,
    //   luggageLiters: 800,
    //   isDefault: false,
    //   mainImageUrl: "https://...",
    //   galleryImages: [],
    //   features: ["7 passagers", "Grandes valises", "Business class"],
    //   certifications: [],
    //   description: "Idéal pour les groupes et familles.",
    // },
  ],

  // ----------------------------------------------------------
  // TARIFICATION PAR DÉFAUT (modifiable via la page /admin)
  // ----------------------------------------------------------
  pricing: {
    basePrice: 0,             // Frais de prise en charge (€)
    pricePerKm: 1.50,         // Tarif par kilomètre (€/km)
    pricePerMinute: 0.80,     // Tarif par minute (€/min)
    minimumPrice: 25,         // Montant minimum d'une course (€)
    nightSurchargePercent: 20, // Majoration nuit (%)
    nightStartHour: 22,       // Début de nuit (22h)
    nightEndHour: 6,          // Fin de nuit (6h)
    hourlyRate: 60,            // Mise à disposition (€/h)
    currency: "EUR",
  },

  // ----------------------------------------------------------
  // FORFAITS FIXES (affiché sur la page d'accueil et /nos-tarifs)
  // ----------------------------------------------------------
  forfaits: [
    {
      id: "grenoble-lyon-airport",
      icon: "plane" as const,
      title: "Grenoble ↔ Aéroport Lyon St-Exupéry",
      price: "220€",
      description: "La navette aéroport la plus confortable, une alternative au taxi.",
      highlight: true,
    },
    {
      id: "lyon-alpe-huez",
      icon: "mountains" as const,
      title: "Aéroport Lyon (LYS) ↔ Alpe d'Huez",
      price: "360€",
      description: "Transfert direct et rapide vers la station. Service Berline Premium.",
      highlight: false,
    },
    {
      id: "grenoble-airport-alpe-huez",
      icon: "plane" as const,
      title: "Aéroport Grenoble (GNB) ↔ Alpe d'Huez",
      price: "260€",
      description: "Transfert optimisé pour votre arrivée en Isère.",
      highlight: true,
    },
    {
      id: "grenoble-geneva",
      icon: "global" as const,
      title: "Grenoble ↔ Genève Aéroport",
      price: "350€",
      description: "Voyage international sans stress. Trajet direct vers GVA.",
      highlight: false,
    },
    {
      id: "grenoble-ski",
      icon: "mountains" as const,
      title: "Grenoble ↔ Stations de Ski",
      price: "À partir de 99€",
      description: "Transferts vers Les 2 Alpes, Chamrousse, Courchevel, etc.",
      highlight: true,
    },
    {
      id: "hourly",
      icon: "clock" as const,
      title: "Mise à Disposition",
      price: "60€/heure",
      description: "Pour vos rendez-vous professionnels, séminaires ou événements privés.",
      highlight: false,
    },
  ],

  // ----------------------------------------------------------
  // CONTACT & RÉSEAUX SOCIAUX
  // ----------------------------------------------------------
  contact: {
    phone: "+33 6 XX XX XX XX",
    phoneDisplay: "06 XX XX XX XX",
    email: "contact@votrevtc.fr",
    whatsapp: "+33 6 XX XX XX XX",  // Laisser vide "" pour désactiver le bouton WhatsApp
    address: "Grenoble, 38000",
    instagram: "",   // URL complète ou vide
    facebook: "",
    linkedIn: "",
  },

  // ----------------------------------------------------------
  // SEO & ANALYTICS
  // ----------------------------------------------------------
  seo: {
    siteUrl: "https://transfert-aeroport-grenoble.fr",
    defaultTitle: "VTC Grenoble | Chauffeur Privé | Navette Aéroport & Stations de Ski",
    defaultDescription:
      "Service de chauffeur VTC à Grenoble. Forfaits fixes pour l'aéroport de Lyon, Genève et les stations de ski. Alternative au taxi.",
    googleAnalyticsId: "G-82VWM02RGP",     // Laisser vide "" pour désactiver
    googleSiteVerification: "",             // Code Google Search Console (optionnel)
  },

  // ----------------------------------------------------------
  // APPARENCE
  // ----------------------------------------------------------
  theme: {
    accentColor: "#35c2b5",   // Couleur principale (boutons, liens actifs)
    darkBg: "#2d3a4c",        // Fond header & footer
    font: "Montserrat",        // Police Google Fonts
  },

  // ----------------------------------------------------------
  // AVIS CLIENTS
  // ----------------------------------------------------------
  reviews: [
    {
      author: "Marie L.",
      rating: 5,
      text: "Service impeccable ! Sophie est ponctuelle, professionnelle et le véhicule est très confortable. Je recommande vivement.",
      date: "2024-12-15",
      platform: "Google",
    },
    {
      author: "Thomas B.",
      rating: 5,
      text: "Transfert aéroport parfait. Trajet silencieux en voiture électrique, aucun stress. Je reviendrai !",
      date: "2024-11-28",
      platform: "Google",
    },
    {
      author: "Sarah M.",
      rating: 5,
      text: "En tant que voyageuse seule, je me suis sentie en totale sécurité. Service au top.",
      date: "2024-10-10",
      platform: "Google",
    },
  ],

  // ----------------------------------------------------------
  // FAQ
  // ----------------------------------------------------------
  faq: [
    {
      question: "Comment puis-je réserver ?",
      answer:
        "Utilisez le formulaire de réservation en ligne, appelez-nous ou envoyez un message WhatsApp. Nous confirmons chaque réservation par email.",
    },
    {
      question: "Quelles sont vos zones de service ?",
      answer:
        "Nous desservons Grenoble et un rayon de 150 km : aéroports de Lyon, Grenoble, Chambéry, et toutes les stations de ski des Alpes.",
    },
    {
      question: "Le prix affiché est-il le prix final ?",
      answer:
        "Oui ! Le prix affiché après estimation est garanti et sans surprise. Aucun supplément caché.",
    },
    {
      question: "Acceptez-vous les animaux de compagnie ?",
      answer:
        "Oui, les animaux en cage ou dans un sac de transport sont les bienvenus. Merci de le signaler à la réservation.",
    },
    {
      question: "Proposez-vous des reçus ou factures ?",
      answer:
        "Oui, une facture est envoyée par email après chaque course. Parfait pour les notes de frais professionnels.",
    },
  ],

  // ----------------------------------------------------------
  // CERTIFICATIONS & BADGES DE CONFIANCE
  // ----------------------------------------------------------
  certifications: [
    { label: "Carte Pro VTC", icon: "🪪" },
    { label: "Assurance RC Pro", icon: "🛡️" },
    { label: "Véhicule récent", icon: "🚗" },
    { label: "Zéro émission", icon: "🌿" },
  ],
};

export type SiteConfig = typeof siteConfig;
export type Vehicle = (typeof siteConfig.vehicles)[number];
export type Forfait = (typeof siteConfig.forfaits)[number];
export type PricingConfig = typeof siteConfig.pricing;
