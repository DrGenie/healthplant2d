/*****************************************************
 * script.js
 * Comprehensive Decision Aid for T2DM Plan Uptake
 * --------------------------------------------------
 * 1) Validates input ranges.
 * 2) Computes latent class membership using the actual
 *    coefficients for each experiment from Table 3.
 * 3) Computes utility for the Plan vs. Opt-Out in each
 *    class, using the relevant WTP parameters.
 * 4) Calculates the overall Plan uptake probability,
 *    weighting by class membership.
 *****************************************************/

document.getElementById('predictBtn').addEventListener('click', predictUptake);

function predictUptake() {
  // 1) Gather and validate user inputs
  const ageVal = parseFloat(document.getElementById('age').value);
  const genderVal = document.getElementById('gender').value;
  const raceVal = document.getElementById('race').value;
  const incomeVal = document.getElementById('income').value;
  const degreeVal = document.getElementById('degree').value;
  const goodHealthVal = document.getElementById('goodHealth').value;

  const efficacySelf = parseFloat(document.getElementById('efficacySelf').value);
  const riskSelf = parseFloat(document.getElementById('riskSelf').value);
  const costSelf = parseFloat(document.getElementById('costSelf').value);
  const efficacyOthers = parseFloat(document.getElementById('efficacyOthers').value);
  const riskOthers = parseFloat(document.getElementById('riskOthers').value);
  const costOthers = parseFloat(document.getElementById('costOthers').value);

  const experimentChoice = document.getElementById('experiment').value;

  // Basic Range Checks
  if (
    ageVal < 18 || ageVal > 120 ||
    riskSelf < 0 || riskSelf > 100 ||
    riskOthers < 0 || riskOthers > 100 ||
    costSelf < 0 || costSelf > 9999 ||
    costOthers < 0 || costOthers > 9999 ||
    efficacySelf < 0 || efficacySelf > 100 ||
    efficacyOthers < 0 || efficacyOthers > 100
  ) {
    alert("Please ensure all inputs are within the specified ranges.");
    return;
  }

  // 2) Compute Class Membership for the selected experiment
  const classProb = computeClassMembership(
    experimentChoice,
    {
      age: ageVal,
      gender: genderVal,
      race: raceVal,
      income: incomeVal,
      degree: degreeVal,
      goodHealth: goodHealthVal
    }
  );

  // 3) Compute Probability of Plan Uptake for each class
  const planProb = computePlanUptake(
    experimentChoice,
    classProb,
    { 
      efficacySelf, 
      riskSelf,
      costSelf,
      efficacyOthers,
      riskOthers,
      costOthers
    }
  );

  // 4) Display Results
  displayResults(classProb, planProb);
}

/************************************************************
 * computeClassMembership
 * Uses a logit model for membership in Class1 vs. Class2
 * with the parameters from Table 3. For each experiment:
 *    logit(P(Class1)/P(Class2)) = Beta0 + BetaX * X ...
 * Then P(Class1) = exp(XBeta) / [1 + exp(XBeta)].
 * Class2 is 1 - P(Class1).
 ************************************************************/
function computeClassMembership(expChoice, demo) {
  let xBeta = 0;

  // Demo indicators
  const female = (demo.gender === "female") ? 1 : 0;
  const white = (demo.race === "white") ? 1 : 0;
  const black = (demo.race === "black") ? 1 : 0;
  const highInc = (demo.income === "high") ? 1 : 0;
  const hasDegree = (demo.degree === "yes") ? 1 : 0;
  const goodHealth = (demo.goodHealth === "yes") ? 1 : 0;
  const age = demo.age; // used directly

  let class1Label = "";
  let class2Label = "";

  if (expChoice === "1") {
    // Experiment 1: Risk-Averse (CL1) vs. Cost-Sensitive (CL2)
    // Table 3 membership parameters for CL1:
    // logit(P(CL1)/P(CL2)) = 0.53 + (-0.29)*Female + 0.54*Age
    //                        + (-0.26)*White + (-0.53)*Black
    //                        + 0.45*HighIncome + 0.11*Degree
    //                        + (-0.03)*GoodHealth
    xBeta = 0.53 
            + (-0.29)*female
            + 0.54*age
            + (-0.26)*white
            + (-0.53)*black
            + 0.45*highInc
            + 0.11*hasDegree
            + (-0.03)*goodHealth;

    class1Label = "Risk-Averse";
    class2Label = "Cost-Sensitive";
  }
  else if (expChoice === "2") {
    // Experiment 2: Equity-Focused (CL1) vs. Cost-Sensitive (CL2)
    // logit(P(CL1)/P(CL2)) = 0.76 + (-0.40)*Female + 0.68*Age
    //                        + (-0.53)*White + (-0.73)*Black
    //                        + (-0.05)*HighIncome + 0.02*Degree
    //                        + 0.06*GoodHealth
    xBeta = 0.76
            + (-0.40)*female
            + 0.68*age
            + (-0.53)*white
            + (-0.73)*black
            + (-0.05)*highInc
            + 0.02*hasDegree
            + 0.06*goodHealth;

    class1Label = "Equity-Focused";
    class2Label = "Cost-Sensitive";
  }
  else {
    // Experiment 3: Equity-Focused (CL1) vs. Self-Focused (CL2)
    // logit(P(CL1)/P(CL2)) = 1.21 + (-0.44)*Female + 0.66*Age
    //                        + (-0.22)*White + (-0.45)*Black
    //                        + (-0.30)*HighIncome + 0.08*Degree
    //                        + (-0.003)*GoodHealth
    xBeta = 1.21
            + (-0.44)*female
            + 0.66*age
            + (-0.22)*white
            + (-0.45)*black
            + (-0.30)*highInc
            + 0.08*hasDegree
            + (-0.003)*goodHealth;

    class1Label = "Equity-Focused";
    class2Label = "Self-Focused";
  }

  const pClass1 = Math.exp(xBeta) / (1 + Math.exp(xBeta));
  const pClass2 = 1 - pClass1;

  return {
    labels: [class1Label, class2Label],
    probs: [pClass1, pClass2]
  };
}

/************************************************************
 * computePlanUptake
 * For each class, we calculate:
 *    U(Plan) = ASC + sum(coeff*attributes)
 *    U(OptOut) = OptOut coefficient
 * Probability(Plan|Class i) = exp(UPlan) / [exp(UPlan) + exp(UOptOut)]
 * Overall Probability(Plan) = sum over i of [P(Class i)*Probability(Plan|Class i)]
 ************************************************************/
function computePlanUptake(expChoice, classData, attrs) {

  const [class1Label, class2Label] = classData.labels;
  const [pC1, pC2] = classData.probs;

  // We'll define a helper function for each experiment
  // that returns Probability(Plan|Class i).
  let planProbClass1 = 0;
  let planProbClass2 = 0;

  if (expChoice === "1") {
    // Experiment 1
    // Class1 (Risk-Averse):
    // ASC = -2.28
    // Opt-out = -27.50
    // Efficacy(self)=26.06, Risk(self)=-28.35, Cost(self)=-0.065
    const uPlan_RA = -2.28 
      + (26.06 * attrs.efficacySelf)
      + (-28.35 * attrs.riskSelf)
      + (-0.065 * attrs.costSelf);
    // Utility of OptOut for RA:
    // UOptOut = -27.50
    const uOptOut_RA = -27.50;

    planProbClass1 = calcChoiceProb(uPlan_RA, uOptOut_RA);

    // Class2 (Cost-Sensitive):
    // ASC = -0.25
    // Opt-out = 2.49
    // Efficacy(self)=6.88, Risk(self)=-5.21, Cost(self)=-0.396
    const uPlan_CS = -0.25
      + (6.88 * attrs.efficacySelf)
      + (-5.21 * attrs.riskSelf)
      + (-0.396 * attrs.costSelf);
    const uOptOut_CS = 2.49;

    planProbClass2 = calcChoiceProb(uPlan_CS, uOptOut_CS);
  }
  else if (expChoice === "2") {
    // Experiment 2
    // Class1 (Equity-Focused):
    // ASC = -0.82
    // Opt-out = -18.15
    // Efficacy(self)=21.03, Risk(self)=-14.61, Cost(self)=-0.094
    const uPlan_EF = -0.82
      + (21.03 * attrs.efficacySelf)
      + (-14.61 * attrs.riskSelf)
      + (-0.094 * attrs.costSelf);
    const uOptOut_EF = -18.15;

    planProbClass1 = calcChoiceProb(uPlan_EF, uOptOut_EF);

    // Class2 (Cost-Sensitive):
    // ASC = 0.18
    // Opt-out = 4.62
    // Efficacy(self)=7.15, Risk(self)=0.15, Cost(self)=-0.363
    const uPlan_CS = 0.18
      + (7.15 * attrs.efficacySelf)
      + (0.15 * attrs.riskSelf)
      + (-0.363 * attrs.costSelf);
    const uOptOut_CS = 4.62;

    planProbClass2 = calcChoiceProb(uPlan_CS, uOptOut_CS);
  }
  else {
    // Experiment 3
    // Class1 (Equity-Focused):
    // ASC = -0.81
    // Opt-out = -40.78
    // Efficacy(self)=33.29, Risk(self)=-17.52, Cost(self)=-0.039
    // Efficacy(others)=12.89, Risk(others)=-22.16, Cost(others)=-0.90
    const uPlan_EF = -0.81
      + (33.29 * attrs.efficacySelf)
      + (-17.52 * attrs.riskSelf)
      + (-0.039 * attrs.costSelf)
      + (12.89 * attrs.efficacyOthers)
      + (-22.16 * attrs.riskOthers)
      + (-0.90 * attrs.costOthers);
    const uOptOut_EF = -40.78;

    planProbClass1 = calcChoiceProb(uPlan_EF, uOptOut_EF);

    // Class2 (Self-Focused):
    // ASC = -0.82
    // Opt-out = 4.16
    // Efficacy(self)=7.10, Risk(self)=-6.69, Cost(self)=-0.353
    // Efficacy(others)=1.44, Risk(others)=0.28, Cost(others)=-0.23
    const uPlan_SF = -0.82
      + (7.10 * attrs.efficacySelf)
      + (-6.69 * attrs.riskSelf)
      + (-0.353 * attrs.costSelf)
      + (1.44 * attrs.efficacyOthers)
      + (0.28 * attrs.riskOthers)
      + (-0.23 * attrs.costOthers);
    const uOptOut_SF = 4.16;

    planProbClass2 = calcChoiceProb(uPlan_SF, uOptOut_SF);
  }

  // Weighted Probability of Plan
  const overallPlanProb = (pC1 * planProbClass1) + (pC2 * planProbClass2);
  return overallPlanProb;
}

/************************************************************
 * calcChoiceProb
 * For a given class, we have:
 *  Probability(Plan) = exp(UPlan) / [exp(UPlan) + exp(UOptOut)]
 ************************************************************/
function calcChoiceProb(uPlan, uOptOut) {
  const expPlan = Math.exp(uPlan);
  const expOut = Math.exp(uOptOut);
  return expPlan / (expPlan + expOut);
}

/************************************************************
 * displayResults
 * Format the output in the appropriate sections
 ************************************************************/
function displayResults(classData, planProb) {
  const classProbabilitiesEl = document.getElementById('classProbabilities');
  const uptakeProbabilityEl = document.getElementById('uptakeProbability');

  // Construct a text representation of class membership
  const [label1, label2] = classData.labels;
  const [prob1, prob2] = classData.probs;

  const membershipString = 
    `${label1}: ${(prob1 * 100).toFixed(2)}%\n` +
    `${label2}: ${(prob2 * 100).toFixed(2)}%`;

  classProbabilitiesEl.textContent = membershipString;

  const uptakeString = 
    `Probability of Plan Uptake (vs. Opt-Out): ${(planProb * 100).toFixed(2)}%`;
  uptakeProbabilityEl.textContent = uptakeString;
}
