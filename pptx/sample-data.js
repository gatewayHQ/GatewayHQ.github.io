// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA — for local testing and development.
// Pass this to generateOfferingMemorandum(OM_SAMPLE_DATA, {}) to generate
// a complete demo deck without filling out the UI form.
// ─────────────────────────────────────────────────────────────────────────────

var OM_SAMPLE_DATA = {
  property: {
    name: 'The Meridian',
    address: '1234 Commerce Street, Denver, CO 80202',
    type: 'Multifamily',
    units: 48,
    yearBuilt: '1987',
    stories: 4,
    lotSize: '0.85 acres',
    buildingSize: 42800,
    parkingSpaces: 52,
    images: {
      hero: null,   // set to a URL or data: URI to test hero image
      photos: [null, null, null],
    },
    amenities: [
      'Gated Parking',
      'Rooftop Terrace',
      'Fitness Center',
      'Package Lockers',
      'Pet-Friendly',
      'On-Site Laundry',
    ],
    description:
      'The Meridian is a well-maintained 48-unit multifamily community ' +
      'positioned in the heart of Denver's emerging Five Points corridor. ' +
      'The property presents a compelling value-add opportunity through ' +
      'strategic interior renovations and operational improvements, with ' +
      'significant upside to market rents currently running 8–12% below ' +
      'comparable repositioned assets in the submarket.',
    highlights: [
      {
        title: 'Value-Add Runway',
        description:
          'In-place rents average 10% below market. Light interior renovation ' +
          'program projected to drive $150–175/month premium per unit.',
      },
      {
        title: 'Strategic Location',
        description:
          'Walking distance to Union Station, RiNo Arts District, and ' +
          'major employment hubs. 92 Walk Score with direct RTD access.',
      },
      {
        title: 'Below-Market Basis',
        description:
          'Offered at $191,667/unit — a meaningful discount to replacement ' +
          'cost of $280K+/unit for comparable new construction in the corridor.',
      },
      {
        title: 'Stable In-Place Cash Flow',
        description:
          '96.2% current occupancy with long-tenured resident base provides ' +
          'a stable income foundation throughout renovation program execution.',
      },
    ],
    execSummary:
      'Gateway Real Estate Advisors is pleased to present The Meridian, a ' +
      '48-unit multifamily community offering investors a rare combination of ' +
      'in-place cash flow stability and significant upside through a defined ' +
      'renovation and re-leasing program in one of Denver\'s strongest rental submarkets.',
    callout:
      'Offered at $9,200,000 — $191,667/unit — representing a 5.65% current cap rate.',
    occupancy: 96.2,
  },

  financials: {
    askingPrice:   9200000,
    pricePerUnit:  191667,
    pricePerSF:    214.95,
    capRate:       5.65,   // percentage
    grm:           12.4,
    noi:           519800,
    grossRevenue:  741600,
    totalExpenses: 221800,
    occupancy:     96.2,
    incomeItems: [
      { label: 'Gross Rental Income',  current: 741600,  proforma: 852000  },
      { label: 'Other Income',         current: 18400,   proforma: 22000   },
      { label: 'Vacancy Loss (3.8%)',  current: -28180,  proforma: -17400  },
      { label: 'Effective Gross Income', current: 731820, proforma: 856600 },
    ],
    expenseItems: [
      { label: 'Property Taxes',          current: 64200,  proforma: 68000  },
      { label: 'Insurance',               current: 28400,  proforma: 29500  },
      { label: 'Repairs & Maintenance',   current: 42600,  proforma: 36000  },
      { label: 'Utilities (Common)',      current: 31200,  proforma: 29800  },
      { label: 'Management Fee (4.5%)',   current: 32930,  proforma: 38550  },
      { label: 'Payroll & Admin',         current: 22470,  proforma: 24000  },
      { label: 'Total Expenses',          current: 221800, proforma: 225850 },
    ],
    proforma: {
      grossRevenue:  856600,
      totalExpenses: 225850,
      noi:           630750,
      capRate:       6.86,
    },
  },

  unitMix: [
    { type: 'Studio',   count: 6,  sf: 480,  marketRent: 1250, inPlaceRent: 1145 },
    { type: '1BD / 1BA', count: 24, sf: 680,  marketRent: 1550, inPlaceRent: 1415 },
    { type: '2BD / 1BA', count: 12, sf: 880,  marketRent: 1950, inPlaceRent: 1790 },
    { type: '2BD / 2BA', count: 6,  sf: 1020, marketRent: 2250, inPlaceRent: 2080 },
  ],

  market: {
    submarket:       'Five Points / Whittier',
    city:            'Denver',
    state:           'CO',
    vacancy:         4.8,
    avgRent:         '$1,720',
    rentGrowth:      4.2,
    population:      '715,500',
    medianIncome:    '$74,500',
    unemployment:    '3.2%',
    medianAge:       '34.6',
    households:      '298,700',
    renterOcc:       '53%',
    ownerOcc:        '47%',
    mapUrl:          null,
    description:
      'Denver's Five Points and Whittier neighborhoods have experienced ' +
      'sustained rent growth driven by employment expansion in the tech, ' +
      'healthcare, and professional services sectors. Proximity to Union ' +
      'Station and the 16th Street Mall positions the submarket as one of ' +
      'the metro's most supply-constrained rental corridors.',
    drivers: [
      {
        title: 'Growing Economy',
        description:
          'Denver's 3.2% unemployment rate and diverse employer base anchor ' +
          'strong renter demand. Major employers within 3 miles include ' +
          'UCHealth, Xcel Energy, and a growing technology sector.',
      },
      {
        title: 'Supply-Constrained Submarket',
        description:
          'Limited developable land and high construction costs constrain new ' +
          'supply. Only 380 units delivered in the submarket over the past 24 months.',
      },
      {
        title: 'Strong Rent Growth',
        description:
          '4.2% year-over-year rent growth outpaces the metro average of 3.1%. ' +
          'Value-add repositioned assets are achieving 10–14% rent premiums.',
      },
    ],
    comps: [
      { name: 'The Aria at Five Points', units: 52, yearBuilt: 2009, price: 10200000, capRate: 5.3,  ppu: 196154 },
      { name: 'Five Points Flats',        units: 36, yearBuilt: 1998, price: 6800000,  capRate: 5.8,  ppu: 188889 },
      { name: 'Whittier Commons',         units: 64, yearBuilt: 2003, price: 13100000, capRate: 5.1,  ppu: 204688 },
    ],
  },

  location: {
    description:
      'The Meridian benefits from exceptional transit access via the ' +
      'RTD light rail (38th & Blake Station, 6-min walk), with direct ' +
      'connections to downtown Denver, Denver International Airport, and ' +
      'the Denver Tech Center.',
    mapUrl: null,
    walkScore:    92,
    transitScore: 78,
    demographics: [],
  },

  brokerage: {
    name:         'Gateway Real Estate Advisors',
    disclaimer:
      'This Offering Memorandum has been prepared by Gateway Real Estate ' +
      'Advisors for use by a limited number of parties and does not purport ' +
      'to provide a necessarily accurate summary of the property or any of ' +
      'the documents related thereto, nor does it purport to be all-inclusive ' +
      'or to contain all of the information which prospective investors may ' +
      'need or desire. All projections have been developed by the owner and ' +
      'designated agents and are based upon assumptions relating to the general ' +
      'economy, competition, and other factors beyond the control of the owner, ' +
      'and therefore are subject to material variation. Additional information ' +
      'and an opportunity to inspect the property will be made available to ' +
      'interested and qualified prospective purchasers.',
    logoUrl:      null,  // dark version (for light slides)
    logoLightUrl: null,  // light version (for dark slides)
    brokers: [
      {
        name:     'John Smith',
        title:    'Vice President, Investment Sales',
        phone:    '(303) 555-1234',
        email:    'jsmith@gatewayre.com',
        photoUrl: null,
      },
      {
        name:     'Sarah Johnson',
        title:    'Associate, Investment Sales',
        phone:    '(303) 555-5678',
        email:    'sjohnson@gatewayre.com',
        photoUrl: null,
      },
    ],
  },
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OM_SAMPLE_DATA;
}
