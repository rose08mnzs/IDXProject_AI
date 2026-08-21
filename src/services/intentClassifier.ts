import type { Intent } from "../agents/types";

export interface IntentClassification {
  intent: Intent;
  intents: Intent[];
  confidence: number;
}

export interface IntentContext {
  hasActivePropertyConversation?: boolean;
  hasActiveMarketConversation?: boolean;
  hasPendingEmailDraft?: boolean;
  hasActiveEmailConversation?: boolean;
}

function hasAny(
  text: string,
  patterns: RegExp[]
): boolean {
  return patterns.some((pattern) =>
    pattern.test(text)
  );
}

// SEMANTIC PROPERTY LANGUAGE
function looksLikeSemanticQuery(text: string): boolean {
  const semanticWords =
    /\b(charming|cozy|luxury|modern|updated|renovated|character|craftsman|mid-century|light-filled|bright|airy|spacious|elegant|stylish|private|serene|unique|dream home|open concept|open floor plan|quiet|peaceful|tree[-\s]?lined|neighborhood|natural light|mountain views?|ocean views?|beach|resort|retreat|entertaining|backyard|starter home|low maintenance|investment|fixer upper|villa|turnkey)\b/i;

  const structuredSignals =
    /(\d+\s*(?:bed|bath|br|bd)|\bunder\b|\$\d|hoa|max\s*hoa|sqft|square feet|\bpool\b|\bview\b)/i;

  return semanticWords.test(text) /*&& !structuredSignals.test(text)*/;
}

// KNOWLEDGE / RAG
function looksLikeKnowledgeQuery(text: string): boolean {
  const t = text.trim().toLowerCase();

  const marketMetricQuestion =
    /\b(average|avg|median|trend|trends|rising|falling|increased|decreased|change|changed|market stats?|statistics|how many|count|inventory)\b/i.test(t);

  const definitionQuestion =
    /\b(what does|what is|what are|define|definition of|meaning of|explain|tell me about|how to|how do|how does|how is|how are|how can|calculate|calculated|calculation|formula|work|works)\b/i.test(t);
  const knowledgeTerm =
    /\b(dom|days on market|cdom|comps?|comparable|escrow|cap rate|list-to-close|list to close|sale-to-list|sale to list|associationfee|association fee|associationamenities|association amenities|yearbuilt|year built|poolprivateyn|pool private|standardstatus|standard status|closeprice|close price|listprice|list price|livingarea|living area|bedroomstotal|bedrooms total|bathroomstotalinteger|bathrooms total|propertytype|property subtype|propertysubtype|listingkey|listingcontractdate|listing contract date|postalcode|unparsedaddress)\b/i.test(t);


  if (marketMetricQuestion && !(definitionQuestion && knowledgeTerm)) {
    return false;
  }

  
  const schemaQuestion =
    /\b(what columns|which columns|what fields|which fields|schema of|columns in|fields in|columns are|fields are)\b/i.test(t);
  
  const hasIdentifier =
    /\b[A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)+\b/.test(
      text
    );

  // CamelCase MLS / RESO fields.
  const hasCamelCaseField =
    /\b[A-Z][a-zA-Z0-9]*[A-Z][A-Za-z0-9]*\b/.test(
      text
    );
  if (schemaQuestion) {
    return true;
  }
    if (
    definitionQuestion &&
    (
      hasIdentifier ||
      hasCamelCaseField ||
      knowledgeTerm
    )
  ) {
    return true;
  }

  return false;
}

// MARKET ANALYTICS
function isMarketQuery(text: string): boolean {
  const market = /\b(market|analytics|analysis|trend|trends|price trend|price trends|days on market|dom|price per sqft|price per square foot|ppsf|list-to-close|list to close|sale-to-list|sale to list|good time to buy|market stats?|market statistics|median price|average price|avg price|average|median|inventory|sold comps?|market conditions?|prices?\s+(?:are\s+|is\s+)?rising|prices?\s+(?:are\s+|is\s+)?falling|prices?\s+(?:are\s+|is\s+)?increasing|prices?\s+(?:are\s+|is\s+)?decreasing|home prices?|housing prices?|appreciation)\b/;
  return market.test(text);
}

// RECOMMENDATION ENGINE
function looksLikeRecommendationQuery(
  text: string
): boolean {
  return /\b(similar|similar homes?|similar properties|recommend|recommendation|recommendations|recommended|comparable|comparables|what else like this|other like this|homes like this|properties like this|closest match|best match|alternatives?|comparable homes?|comparable properties|find me something like|show me something similar|find similar|other properties like)\b/.test(text);
}

// PROPERTY SEARCH
function looksLikePropertySearch(
  text: string
): boolean {
  return /\b(find|show|search|looking for|look for|homes?|houses?|house|property|properties|listing|listings|condo|condos|condominium|condominiums|townhome|townhomes|town house|town houses|single family|single-family|apartment|apartments|duplex|triplex|quadruplex|loft|lofts|cabin|cabins|farm|farms|mobile home|mobile homes|manufactured home|manufactured homes|mixed use|mixed-use|studio|studios|timeshare|own your own|boat slip|boat slips|co-ownership|coownership|stock cooperative|bedroom|bedrooms|bed|beds|br|bdrm|bd|bathroom|bathrooms|bath|baths|ba|sqft|square feet|sq ft|sf|price|budget|under|below|less than|up to|maximum|max|asking|priced|pool|view|hoa|association fee|monthly hoa|dues|zip)\b/.test(text) ||
  /\$\s*[\d,.]+\s*[kmb]?/i.test(text) ||
  /\b\d+\s*(?:bed|beds|bedroom|bedrooms)\b/i.test(text) ||
  /\b\d+(?:\.5)?\s*(?:bath|baths|bathroom|bathrooms)\b/i.test(text) ||
  /\b\d[\d,]*\s*(?:sqft|sq\s*ft|square feet|sf)\b/i.test(text);
}

// EMAIL
function looksLikeEmailQuery(
  text: string
): boolean {
  return /\b(email|e-mail|email me|send me an email|send an email|draft an email|prepare an email|create an email|email report|email summary|approve email|approve|send email|send it|yes, send it|cancel|cancel email|discard email)\b/.test(text);
}

// ACTIVE SESSION SUPPORT
function applyConversationContext(
  matched: Intent[],
  context?: IntentContext
): Intent[] {
  const result = [...matched];

  if (context?.hasActivePropertyConversation &&!result.includes("search")) {
    result.push("search");
  }

  if (context?.hasActiveMarketConversation &&!result.includes("market")) {
    result.push("market");
  }

  return result;
}

// SPECIAL CASES
function isPlainConversationalFollowUp(text: string): boolean {
  return /^(yes|yeah|yep|no|nope|any|anything|either|flexible|whatever|sure|okay|ok|continue|go ahead|approve|send it|cancel)$/i.test(
    text.trim()
  );
}
function isDefinitionQuestion(text: string): boolean {
  return /\b(what does|what is|what are|define|definition of|meaning of|explain|tell me about)\b/.test(text);
}

function isEmailAddress(
  text: string
): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(
    text.trim()
  );
}

function isEmailArtifactRequest(
  text: string
): boolean {
  const hasEmail =
    /\b(email|e-mail)\b/i.test(text);

  const hasArtifact =
    /\b(property summary|market report|market summary|recommendation digest|recommendations|listing alert|matching listings|results)\b/i.test(
      text
    );

  return hasEmail && hasArtifact;
}

function isSearchAndEmailRequest(
  text: string
): boolean {
  const searchAction =
    /\b(find|search|show|look for|looking for)\b/i.test(
      text
    );

  const emailAction =
    /\b(email|e-mail)\b/i.test(
      text
    );

  return (
    searchAction &&
    emailAction
  );
}

// MAIN CLASSIFIER
export function classifyIntent(query: string,context: IntentContext = {}
): IntentClassification {
  const text =query.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();

  if (!text) {
    return {
      intent: "unknown",
      intents: [],
      confidence: 1,
    };
  }
 // Email recipient follow-up
  if (
  context.hasActiveEmailConversation
) {
  return {
    intent: "email",
    intents: ["email"],
    confidence: 0.99,
  };
}
  // Follow-up messages should use session state.
  if (isPlainConversationalFollowUp(text)) {
    if (context.hasPendingEmailDraft &&
      /^(yes|yeah|yep|sure|okay|ok|approve|cancel|send it|go ahead)$/i.test(text)) {
      return {
        intent: "email",
        intents: ["email"],
        confidence: 0.99,
      };
    }

    if (context.hasActivePropertyConversation) {
      return {
        intent: "search",
        intents: ["search"],
        confidence: 0.98,
      };
    }

    if (context.hasActiveMarketConversation) {
      return {
        intent: "market",
        intents: ["market"],
        confidence: 0.98,
      };
    }
  }


  const searchIntent =looksLikePropertySearch(text) || looksLikeSemanticQuery(text);
  const marketIntent =isMarketQuery(text);
  const recommendationIntent =looksLikeRecommendationQuery(text);
  const knowledgeIntent =looksLikeKnowledgeQuery(text);
  const emailIntent =looksLikeEmailQuery(text);
  const definitionQuestion =isDefinitionQuestion(text);

  let matched: Intent[] = [];
  // RECOMMENDATION + EMAIL
  // Example:
  // "find similar homes and email them to me"
  if (emailIntent && recommendationIntent ) {
    return {
      intent: "mixed",
      intents: [
        "recommend",
        "email",
      ],
      confidence: 0.99,
    };
  }
  // TRUE SEARCH + EMAIL REQUEST
  // Example:
  // "find homes in Irvine and email me the results"
  if (isSearchAndEmailRequest(text)) {
    return {
      intent: "mixed",
      intents: [
        "search",
        "email",
      ],
      confidence: 0.99,
    };
  }

  // EMAIL ARTIFACT REQUEST
  // Examples:
  // "email property summary to me@gmail.com"
  // "email market report for Irvine to me@gmail.com"
  if (emailIntent && isEmailArtifactRequest(text)) {
    return {
      intent: "email",
      intents: ["email"],
      confidence: 0.99,
    };
  }

  if (searchIntent) {
    matched.push("search");
  }

  if (marketIntent) {
    matched.push("market");
  }

  if (recommendationIntent) {
    matched.push("recommend");
  }

  if (knowledgeIntent) {
    matched.push("knowledge");
  }

  if (emailIntent) {
    matched.push("email");
  }

  matched = applyConversationContext( matched, context);
  if (definitionQuestion && knowledgeIntent && !marketIntent && !recommendationIntent && !emailIntent) {
    return {
      intent: "knowledge",
      intents: ["knowledge"],
      confidence: 0.99,
    };
  }
  // Email-only request.
  if (emailIntent && !searchIntent && !marketIntent && !recommendationIntent && !knowledgeIntent ) {
    return {
      intent: "email",
      intents: ["email"],
      confidence: 0.99,
    };
  }

  if (knowledgeIntent && !marketIntent && !recommendationIntent && !emailIntent) {
    return {
      intent: "knowledge",
      intents: ["knowledge"],
      confidence: 0.98,
    };
  }

  if (recommendationIntent && !marketIntent && !knowledgeIntent && !emailIntent) {
    return {
      intent: "recommend",
      intents: ["recommend"],
      confidence: 0.97,
    };
  }

  

  // Nothing detected.
  if (matched.length === 0) {
    return {
      intent: "unknown",
      intents: [],
      confidence: 0.4,
    };
  }

  // One intent.
  if (matched.length === 1) {
    return {
      intent: matched[0],
      intents: matched,
      confidence: 0.95,
    };
  }
  // Multiple intents.
  return {
    intent: "mixed",
    intents: matched,
    confidence: 0.95,
  };
}