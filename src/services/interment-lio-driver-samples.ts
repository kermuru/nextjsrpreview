/**
 * Sample payloads for the interment driver runner.
 *
 * THE FIRST ONE IS THE REAL TICKET. #16747 LIVE is the replacement interment
 * order for RONALENE T. CRUZ: org 162012 (mints an NLIO), ownership 2175 =
 * Criselda Cruz Cataluna's lot 2-5-30, bottom layer, Standard Lawn.
 *
 * Every id in it was read from the replica, and several are period-specific
 * because the interment was 2025-06-07, not today:
 *
 *   variation        68  (live Feb-Aug 2025) -- NOT 100, created Feb 2026
 *   project standard 451 (Feb 2025, 15 BOM lines) -- NOT 630 (Feb 2026, 5 lines)
 *   inclusions       20  -- today's list has 21; E-LIBING was added Feb 2026
 *   amounts          38,990 / 0 / 38,990 -- org 162012 books this package VAT-free
 *
 * TWO FIELDS ARE DELIBERATELY BLANK:
 *   relationshipDeparted -- the original said FAMILY FRIEND, which described the
 *     PREVIOUS informant (Febie Alvarado), not Criselda. Fill it in.
 *   glSubacctId -- the ERP mints the subaccount but does not write it back to
 *     wip_i_project.gl_subacct_id. Leave blank, then fix after the run.
 *
 * The other two samples are rehearsals on a stand-in lot under org 162011, which
 * mints an LIO rather than an NLIO. They are not the ticket.
 */

export const LIO_16747_PAYLOAD = {
  "usercode": 1782550599351,
  "orgCode": 162012,
  "submoduleCode": "LIO",
  "mpLOwnershipId": 2175,
  "mpIOwnerId": 6197,
  "mpIIntermentpackageId": 5,
  "mpIIntermentVariationId": 68,
  "mpISpaceId": 1,
  "dateInterment": "2025-06-07",
  "timeStartingHours": 10,
  "timeStartingMinute": 30,
  "massStartingTimeHours": 0,
  "massStartingTimeMinute": 0,
  "isGatewalk": true,
  "isWithMass": false,
  "massLocation": "NONE",
  "programLangauge": "TAGALOG",
  "nameOpeningPrayer": "NONE",
  "relationshipNameOpeningPrayer": "NONE",
  "nameEulogySpeaker": "NONE",
  "relationshipNameEulogySpeaker": "NONE",
  "nameEulogySpeaker2": "NONE",
  "relationshipNameEulogySpeaker2": "NONE",
  "nameMessageOfThanks": "NONE",
  "relationshipNameMessageOfThanks": "NONE",
  "nameCommitalPrayer": "NONE",
  "relationshipNameCommitalPrayer": "NONE",
  "relationshipProofSumitted": "NONE",
  "relationshipDeparted": "FAMILY FRIEND",
  "address": "GENERAL SANTOS CITY",
  "contactNo": "09077144263",
  "amtSales": "38990.00",
  "amtVat": "0.00",
  "amtPayment": "38990.00",
  "occupancies": [
    {
      "mpIIntermentVesselId": 3,
      "mpIIntermentitemTypeId": 3,
      "occupantName": "RONALENE T. CRUZ",
      "dateOfBirth": "2009-12-06",
      "dateOfDeath": "2025-05-29",
      "causeOfDeath": "DIABETIC KETOACIDOSIS",
      "religion": ""
    }
  ],
  "inclusions": [
    {
      "mpIIntermentItemInclusionId": 1,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 4,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 7,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 9,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 10,
      "qty": 24
    },
    {
      "mpIIntermentItemInclusionId": 12,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 13,
      "qty": 6
    },
    {
      "mpIIntermentItemInclusionId": 19,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 23,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 30,
      "qty": 250
    },
    {
      "mpIIntermentItemInclusionId": 31,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 32,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 33,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 34,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 49,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 50,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 51,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 58,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 59,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 60,
      "qty": 1
    }
  ],
  "requestedSongs": [],
  "projectDetails": {
    "wipIProjectCategoryId": 30,
    "bparIPersonReqBuId": 1967,
    "bparIPersonStageCustodianId": 15675,
    "purpose": "Interment",
    "address": "SAN FELIPE TANTANGAN",
    "dateFromDesign": "2025-06-04",
    "dateToDesign": "2025-07-04",
    "dateFromBgt": "2025-06-04",
    "dateToBgt": "2025-07-04",
    "dateFromImpl": "2025-06-04",
    "dateToImpl": "2025-07-04",
    "dateFromTargetStart": "2025-06-07",
    "dateFromTargetEnd": "2025-06-07"
  },
  "projectStandards": [
    {
      "wipIProjectStdId": 451,
      "projectType": "ACCREDITEDPAIR",
      "astIAssetId": null,
      "glAcctId": 51002,
      "glSubacctId": ""
    }
  ]
} as const;

export const LIO_16747_ORG162011_PAYLOAD = {
  "usercode": 1782550599351,
  "orgCode": 162011,
  "submoduleCode": "LIO",
  "mpLOwnershipId": 2175,
  "mpIOwnerId": 6197,
  "mpIIntermentpackageId": 5,
  "mpIIntermentVariationId": 68,
  "mpISpaceId": 1,
  "dateInterment": "2025-06-07",
  "timeStartingHours": 10,
  "timeStartingMinute": 30,
  "massStartingTimeHours": 0,
  "massStartingTimeMinute": 0,
  "isGatewalk": true,
  "isWithMass": false,
  "massLocation": "NONE",
  "programLangauge": "TAGALOG",
  "nameOpeningPrayer": "NONE",
  "relationshipNameOpeningPrayer": "NONE",
  "nameEulogySpeaker": "NONE",
  "relationshipNameEulogySpeaker": "NONE",
  "nameEulogySpeaker2": "NONE",
  "relationshipNameEulogySpeaker2": "NONE",
  "nameMessageOfThanks": "NONE",
  "relationshipNameMessageOfThanks": "NONE",
  "nameCommitalPrayer": "NONE",
  "relationshipNameCommitalPrayer": "NONE",
  "relationshipProofSumitted": "NONE",
  "relationshipDeparted": "FAMILY FRIEND",
  "address": "GENERAL SANTOS CITY",
  "contactNo": "09077144263",
  "amtSales": "38990.00",
  "amtVat": "4678.80",
  "amtPayment": "43668.80",
  "occupancies": [
    {
      "mpIIntermentVesselId": 3,
      "mpIIntermentitemTypeId": 3,
      "occupantName": "RONALENE T. CRUZ",
      "dateOfBirth": "2009-12-06",
      "dateOfDeath": "2025-05-29",
      "causeOfDeath": "DIABETIC KETOACIDOSIS",
      "religion": ""
    }
  ],
  "inclusions": [
    {
      "mpIIntermentItemInclusionId": 1,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 4,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 7,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 9,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 10,
      "qty": 24
    },
    {
      "mpIIntermentItemInclusionId": 12,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 13,
      "qty": 6
    },
    {
      "mpIIntermentItemInclusionId": 19,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 23,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 30,
      "qty": 250
    },
    {
      "mpIIntermentItemInclusionId": 31,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 32,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 33,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 34,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 49,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 50,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 51,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 58,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 59,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 60,
      "qty": 1
    }
  ],
  "requestedSongs": [],
  "projectDetails": {
    "wipIProjectCategoryId": 30,
    "bparIPersonReqBuId": 1967,
    "bparIPersonStageCustodianId": 15675,
    "purpose": "Interment",
    "address": "SAN FELIPE TANTANGAN",
    "dateFromDesign": "2025-06-04",
    "dateToDesign": "2025-07-04",
    "dateFromBgt": "2025-06-04",
    "dateToBgt": "2025-07-04",
    "dateFromImpl": "2025-06-04",
    "dateToImpl": "2025-07-04",
    "dateFromTargetStart": "2025-06-07",
    "dateFromTargetEnd": "2025-06-07"
  },
  "projectStandards": [
    {
      "wipIProjectStdId": 451,
      "projectType": "ACCREDITEDPAIR",
      "astIAssetId": null,
      "glAcctId": 51002,
      "glSubacctId": ""
    }
  ]
} as const;

export const LIO_BACKDATED_PAYLOAD = {
  "usercode": 1782550599351,
  "orgCode": 162011,
  "submoduleCode": "LIO",
  "mpLOwnershipId": 2596,
  "mpIOwnerId": 6101,
  "mpIIntermentpackageId": 5,
  "mpIIntermentVariationId": 100,
  "mpISpaceId": 1,
  "dateInterment": "2025-06-07",
  "timeStartingHours": 10,
  "timeStartingMinute": 30,
  "massStartingTimeHours": 0,
  "massStartingTimeMinute": 0,
  "isGatewalk": false,
  "isWithMass": false,
  "massLocation": "",
  "programLangauge": "English",
  "nameOpeningPrayer": "",
  "relationshipNameOpeningPrayer": "",
  "nameEulogySpeaker": "",
  "relationshipNameEulogySpeaker": "",
  "nameEulogySpeaker2": "",
  "relationshipNameEulogySpeaker2": "",
  "nameMessageOfThanks": "",
  "relationshipNameMessageOfThanks": "",
  "nameCommitalPrayer": "",
  "relationshipNameCommitalPrayer": "",
  "amtSales": "50000.00",
  "amtVat": "6000.00",
  "amtPayment": "56000.00",
  "relationshipProofSumitted": "SSS ID",
  "relationshipDeparted": "FAMILY FRIEND",
  "address": "GENERAL SANTOS CITY",
  "contactNo": "09077144263",
  "occupancies": [
    {
      "mpIIntermentVesselId": 3,
      "mpIIntermentitemTypeId": 3,
      "occupantName": "AGENT TEST OCCUPANT",
      "dateOfBirth": "1950-01-01",
      "dateOfDeath": "2026-10-10",
      "causeOfDeath": "NATURAL CAUSES",
      "religion": "ROMAN CATHOLIC"
    }
  ],
  "inclusions": [
    {
      "mpIIntermentItemInclusionId": 1,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 4,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 7,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 9,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 10,
      "qty": 24
    },
    {
      "mpIIntermentItemInclusionId": 12,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 13,
      "qty": 6
    },
    {
      "mpIIntermentItemInclusionId": 19,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 23,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 30,
      "qty": 250
    },
    {
      "mpIIntermentItemInclusionId": 31,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 32,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 33,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 34,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 49,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 50,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 51,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 58,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 59,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 60,
      "qty": 1
    }
  ],
  "requestedSongs": [],
  "projectDetails": {
    "wipIProjectCategoryId": 30,
    "bparIPersonReqBuId": 1967,
    "bparIPersonStageCustodianId": 15675,
    "purpose": "Interment",
    "address": "",
    "dateFromDesign": null,
    "dateToDesign": null,
    "dateFromBgt": null,
    "dateToBgt": null,
    "dateFromImpl": null,
    "dateToImpl": null,
    "dateFromTargetStart": "2025-06-07",
    "dateFromTargetEnd": "2025-06-07"
  },
  "projectStandards": [
    {
      "wipIProjectStdId": 451,
      "projectType": "ACCREDITEDPAIR",
      "astIAssetId": null,
      "glAcctId": 51002,
      "glSubacctId": 41311
    }
  ]
} as const;

export const LIO_FUTURE_PAYLOAD = {
  "usercode": 1782550599351,
  "orgCode": 162011,
  "submoduleCode": "LIO",
  "mpLOwnershipId": 2596,
  "mpIOwnerId": 6101,
  "mpIIntermentpackageId": 5,
  "mpIIntermentVariationId": 100,
  "mpISpaceId": 1,
  "dateInterment": "2026-10-15",
  "timeStartingHours": 8,
  "timeStartingMinute": 0,
  "massStartingTimeHours": 0,
  "massStartingTimeMinute": 0,
  "isGatewalk": false,
  "isWithMass": false,
  "massLocation": "",
  "programLangauge": "English",
  "nameOpeningPrayer": "",
  "relationshipNameOpeningPrayer": "",
  "nameEulogySpeaker": "",
  "relationshipNameEulogySpeaker": "",
  "nameEulogySpeaker2": "",
  "relationshipNameEulogySpeaker2": "",
  "nameMessageOfThanks": "",
  "relationshipNameMessageOfThanks": "",
  "nameCommitalPrayer": "",
  "relationshipNameCommitalPrayer": "",
  "amtSales": "50000.00",
  "amtVat": "6000.00",
  "amtPayment": "56000.00",
  "relationshipProofSumitted": "SSS ID",
  "relationshipDeparted": "FAMILY FRIEND",
  "address": "GENERAL SANTOS CITY",
  "contactNo": "09077144263",
  "occupancies": [
    {
      "mpIIntermentVesselId": 3,
      "mpIIntermentitemTypeId": 3,
      "occupantName": "AGENT TEST OCCUPANT",
      "dateOfBirth": "1950-01-01",
      "dateOfDeath": "2026-10-10",
      "causeOfDeath": "NATURAL CAUSES",
      "religion": "ROMAN CATHOLIC"
    }
  ],
  "inclusions": [
    {
      "mpIIntermentItemInclusionId": 1,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 4,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 7,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 9,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 10,
      "qty": 24
    },
    {
      "mpIIntermentItemInclusionId": 12,
      "qty": 2
    },
    {
      "mpIIntermentItemInclusionId": 13,
      "qty": 6
    },
    {
      "mpIIntermentItemInclusionId": 19,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 23,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 30,
      "qty": 250
    },
    {
      "mpIIntermentItemInclusionId": 31,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 32,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 33,
      "qty": 3
    },
    {
      "mpIIntermentItemInclusionId": 34,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 43,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 49,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 50,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 51,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 58,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 59,
      "qty": 1
    },
    {
      "mpIIntermentItemInclusionId": 60,
      "qty": 1
    }
  ],
  "requestedSongs": [],
  "projectDetails": {
    "wipIProjectCategoryId": 30,
    "bparIPersonReqBuId": 1967,
    "bparIPersonStageCustodianId": 15675,
    "purpose": "Interment",
    "address": "",
    "dateFromDesign": null,
    "dateToDesign": null,
    "dateFromBgt": null,
    "dateToBgt": null,
    "dateFromImpl": null,
    "dateToImpl": null,
    "dateFromTargetStart": "2026-10-15",
    "dateFromTargetEnd": "2026-10-15"
  },
  "projectStandards": [
    {
      "wipIProjectStdId": 630,
      "projectType": "ACCREDITEDPAIR",
      "astIAssetId": null,
      "glAcctId": 51002,
      "glSubacctId": 41311
    }
  ]
} as const;

export const SAMPLES: { key: string; label: string; payload: unknown }[] = [
  {
    key: '16747',
    label: '#16747 LIVE — RONALENE T. CRUZ · org 162012 · lot 2-5-30 · fill relationshipDeparted',
    payload: LIO_16747_PAYLOAD,
  },
  {
    key: '16747-162011',
    label: '#16747 — org 162011 (LIO prefix, VAT on top: 38,990 + 4,678.80 = 43,668.80)',
    payload: LIO_16747_ORG162011_PAYLOAD,
  },
  {
    key: 'backdated',
    label: 'Rehearsal — back-dated, org 162011 (LIO prefix, stand-in lot)',
    payload: LIO_BACKDATED_PAYLOAD,
  },
  {
    key: 'future',
    label: 'Rehearsal — future-dated, org 162011 (LIO prefix, stand-in lot)',
    payload: LIO_FUTURE_PAYLOAD,
  },
];

/** Kept for callers that imported the original name. */
export const LIO_SAMPLE_PAYLOAD = LIO_16747_PAYLOAD;
