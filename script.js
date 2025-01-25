/******************************************************
 * script.js - T2DM Decision Aid (Preference-Space)
 * ---------------------------------------------------
 * Features:
 * - EXACT membership & utility coefficients from
 *   your final preference-space table for Exp1, Exp2, Exp3.
 * - Disables "others" inputs for Exp1 & Exp2.
 * - Interactive sliders for risk/cost.
 * - Bar charts to visualize membership & plan uptake.
 * - Functional tab interface.
 ******************************************************/

// Ensure the DOM is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', function() {
  // Grab elements
  const experimentEl = document.getElementById('experiment');
  const efficacySelfEl = document.getElementById('efficacySelf');
  const riskSelfEl = document.getElementById('riskSelf');
  const costSelfEl = document.getElementById('costSelf');
  const efficacyOthersEl = document.getElementById('efficacyOthers');
  const riskOthersEl = document.getElementById('riskOthers');
  const costOthersEl = document.getElementById('costOthers');

  const efficacySelfVal = document.getElementById('efficacySelfValue');
  const riskSelfVal = document.getElementById('riskSelfValue');
  const costSelfVal = document.getElementById('costSelfValue');
  const efficacyOthersVal = document.getElementById('efficacyOthersValue');
  const riskOthersVal = document.getElementById('riskOthersValue');
  const costOthersVal = document.getElementById('costOthersValue');

  const predictBtn = document.getElementById('predictBtn');

  // Results
  const classProbabilitiesEl = document.getElementById('classProbabilities');
  const uptakeProbabilityEl = document.getElementById('uptakeProbability');

  // Chart contexts
  const membershipCtx = document.getElementById('membershipChart').getContext('2d');
  const uptakeCtx = document.getElementById('uptakeChart').getContext('2d');

  // We'll store references to the bar charts so we can update them
  let membershipChart;
  let uptakeChart;

  /******************************************************
   * SLIDER LISTENERS - display their values in real-time
   ******************************************************/
  [efficacySelfEl, riskSelfEl, costSelfEl,
   efficacyOthersEl, riskOthersEl, costOthersEl].forEach(slider => {
    slider.addEventListener('input', () => {
      updateSliderValue(slider);
    });
  });

  // Updates the text next to each slider
  function updateSliderValue(slider) {
    const val = slider.value;
    switch (slider.id) {
      case 'efficacySelf': efficacySelfVal.textContent = val; break;
      case 'riskSelf': riskSelfVal.textContent = val; break;
      case 'costSelf': costSelfVal.textContent = val; break;
      case 'efficacyOthers': efficacyOthersVal.textContent = val; break;
      case 'riskOthers': riskOthersVal.textContent = val; break;
      case 'costOthers': costOthersVal.textContent = val; break;
    }
  }

  /******************************************************
   * EXPERIMENT CHANGE -> handle disabling "others" 
   * in Exp1 & Exp2. In Exp3, enable them.
   ******************************************************/
  experimentEl.addEventListener('change', toggleOthers);

  function toggleOthers() {
    const expChoice = experimentEl.value;
    const disableOthers = (expChoice !== '3');

    efficacyOthersEl.disabled = disableOthers;
    riskOthersEl.disabled = disableOthers;
    costOthersEl.disabled = disableOthers;

    // If disabled, set them to 0
    if (disableOthers) {
      efficacyOthersEl.value = 0;
      riskOthersEl.value = 0;
      costOthersEl.value = 0;
      efficacyOthersVal.textContent = "0";
      riskOthersVal.textContent = "0";
      costOthersVal.textContent = "0";
    }
  }

  // Initialize on page load
  toggleOthers();

  /******************************************************
   * Button event to PREDICT
   ******************************************************/
  predictBtn.addEventListener('click', predictUptake);

  function predictUptake() {
    // Gather user inputs
    const age = parseFloat(document.getElementById('age').value);
    const gender = document.getElementById('gender').value;
    const race = document.getElementById('race').value;
    const income = document.getElementById('income').value;
    const degree = document.getElementById('degree').value;
    const goodHealth = document.getElementById('goodHealth').value;

    const expChoice = document.getElementById('experiment').value;

    // Sliders
    const effSelf = parseFloat(efficacySelfEl.value);
    const rSelf = parseFloat(riskSelfEl.value);
    const cSelf = parseFloat(costSelfEl.value);
    const effOthers = parseFloat(efficacyOthersEl.value);
    const rOthers = parseFloat(riskOthersEl.value);
    const cOthers = parseFloat(costOthersEl.value);

    // Basic validation
    if (isNaN(age) || age < 18 || age > 120) {
      alert("Please ensure Age is between 18 and 120.");
      return;
    }

    // 1) Class membership
    const { pC1, pC2, label1, label2 } = computeClassMembership(
      expChoice, { gender, age, race, income, degree, goodHealth }
    );

    // 2) Plan uptake
    const planProb = computePlanUptake(
      expChoice, pC1, pC2, effSelf, rSelf, cSelf, effOthers, rOthers, cOthers
    );

    // 3) Display
    displayResults(label1, label2, pC1, pC2, planProb);
  }

  /******************************************************
   * computeClassMembership
   * Using logistic transform with the EXACT coefficients
   * from your Probability model for each experiment.
   ******************************************************/
  function computeClassMembership(expChoice, demo) {
    const female = (demo.gender === "female") ? 1 : 0;
    const white = (demo.race === "white") ? 1 : 0;
    const black = (demo.race === "black") ? 1 : 0;
    const highIncome = (demo.income === "high") ? 1 : 0;
    const deg = (demo.degree === "yes") ? 1 : 0;
    const gHealth = (demo.goodHealth === "yes") ? 1 : 0;
    const age = demo.age;

    let xBeta = 0;
    let label1 = "";
    let label2 = "";

    if (expChoice === '1') {
      // Experiment 1
      // logit(Class1 / Class2) = 0.5317 
      //   + (-0.2915)*Female 
      //   + (-0.5387)*Age 
      //   + ( 0.2843)*White 
      //   + ( 0.5616)*Black
      //   + ( 0.4366)*HighIncome 
      //   + (-0.1365)*Degree 
      //   + ( 0.0204)*GoodHealth
      xBeta = 0.5317 
           + (-0.2915)*female
           + (-0.5387)*age
           + ( 0.2843)*white
           + ( 0.5616)*black
           + ( 0.4366)*highIncome
           + (-0.1365)*deg
           + ( 0.0204)*gHealth;

      label1 = "Class 1: Risk-Averse";
      label2 = "Class 2: Cost-Sensitive";
    }
    else if (expChoice === '2') {
      // Experiment 2
      // logit(Class1 / Class2) = 0.7645
      //   + (-0.3959)*Female 
      //   + (-0.6826)*Age
      //   + ( 0.5410)*White 
      //   + ( 0.7393)*Black
      //   + ( 0.0443)*HighInc
      //   + (-0.0162)*Degree
      //   + (-0.0668)*GoodHealth
      xBeta = 0.7645
           + (-0.3959)*female
           + (-0.6826)*age
           + ( 0.5410)*white
           + ( 0.7393)*black
           + ( 0.0443)*highIncome
           + (-0.0162)*deg
           + (-0.0668)*gHealth;

      label1 = "Class 1: Equity-Focused";
      label2 = "Class 2: Cost-Sensitive";
    }
    else {
      // Experiment 3
      // logit(Class1 / Class2) = 1.2089
      //   + (-0.4362)*Female
      //   + (-0.6528)*Age
      //   + ( 0.2580)*White
      //   + ( 0.5351)*Black
      //   + (-0.3153)*HighInc
      //   + (-0.0497)*Degree
      //   + ( 0.0320)*GoodHealth
      xBeta = 1.2089
           + (-0.4362)*female
           + (-0.6528)*age
           + ( 0.2580)*white
           + ( 0.5351)*black
           + (-0.3153)*highIncome
           + (-0.0497)*deg
           + ( 0.0320)*gHealth;

      label1 = "Class 1: Equity-Focused";
      label2 = "Class 2: Self-Focused";
    }

    // Debug log (optional)
    // console.log(`Membership xBeta: ${xBeta}`);

    const pClass1 = Math.exp(xBeta) / (1 + Math.exp(xBeta));
    const pClass2 = 1 - pClass1;

    // console.log(`Membership pC1= ${pClass1}, pC2= ${pClass2}`);

    return { pC1: pClass1, pC2: pClass2, label1, label2 };
  }

  /******************************************************
   * computePlanUptake
   * We use the final preference-space utilities:
   * Probability(Plan|Class i) = exp(UPlan) / [exp(UPlan) + exp(UOptOut)]
   * Weighted by pC1, pC2 -> final plan uptake.
   ******************************************************/
  function computePlanUptake(expChoice, pC1, pC2,
    effS, rS, cS, effO, rO, cO) {

    let planProbC1 = 0;
    let planProbC2 = 0;

    if (expChoice === '1') {
      // =============== Experiment 1 ===============
      // Class 1 (Risk-Averse)
      // asc=-0.1484, optout=-1.7885
      // efficacy=1.6944, risk=-1.8439, cost=-0.0650
      const uPlan_C1 = -0.1484
        + 1.6944*effS
        + (-1.8439)*rS
        + (-0.0650)*cS;
      const uOptOut_C1 = -1.7885;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Cost-Sensitive)
      // asc=-0.1010, optout=0.9865
      // efficacy=2.7260, risk=-2.0641, cost=-0.3963
      const uPlan_C2 = -0.1010
        + 2.7260*effS
        + (-2.0641)*rS
        + (-0.3963)*cS;
      const uOptOut_C2 = 0.9865;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);

    }
    else if (expChoice === '2') {
      // =============== Experiment 2 ===============
      // Class 1 (Equity-Focused)
      // asc=-0.0772, optout=-1.7062
      // efficacy=1.9771, risk=-1.3736, cost=-0.0940
      const uPlan_C1 = -0.0772
        + 1.9771*effS
        + (-1.3736)*rS
        + (-0.0940)*cS;
      const uOptOut_C1 = -1.7062;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Cost-Sensitive)
      // asc=0.0654, optout=1.6773
      // efficacy=2.5939, risk=0.0550, cost=-0.3627
      const uPlan_C2 = 0.0654
        + 2.5939*effS
        + 0.0550*rS
        + (-0.3627)*cS;
      const uOptOut_C2 = 1.6773;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);

    }
    else {
      // =============== Experiment 3 ===============
      // Class 1 (Equity-Focused)
      // asc=-0.0318, optout=-1.6011
      // efficacy-self=1.3070, risk-self=-0.6877
      // efficacy-others=0.5063, risk-others=-0.8702
      // cost-others=-0.0352, cost-self=-0.0393
      const uPlan_C1 = -0.0318
        + 1.3070*effS
        + (-0.6877)*rS
        + (-0.0393)*cS
        + 0.5063*effO
        + (-0.8702)*rO
        + (-0.0352)*cO;
      const uOptOut_C1 = -1.6011;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Self-Focused)
      // asc=-0.2911, optout=1.4660
      // efficacy-self=2.5028, risk-self=-2.3606
      // efficacy-others=0.5076, risk-others=0.1003
      // cost-others=-0.0794, cost-self=-0.3527
      const uPlan_C2 = -0.2911
        + 2.5028*effS
        + (-2.3606)*rS
        + (-0.3527)*cS
        + 0.5076*effO
        + 0.1003*rO
        + (-0.0794)*cO;
      const uOptOut_C2 = 1.4660;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);
    }

    // Weighted final
    const overallPlanProb = (pC1 * planProbC1) + (pC2 * planProbC2);

    // Debug logs (optional)
    // console.log(`uPlan_C1= ${uPlan_C1}, uOptOut_C1= ${uOptOut_C1}, planProbC1= ${planProbC1}`);
    // console.log(`uPlan_C2= ${uPlan_C2}, uOptOut_C2= ${uOptOut_C2}, planProbC2= ${planProb_C2}`);
    // console.log(`overallPlanProb= ${overallPlanProb}`);

    return overallPlanProb;
  }

  /******************************************************
   * logisticChoice => Probability(Plan) = exp(UPlan)
   *  / [ exp(UPlan) + exp(UOptOut) ]
   ******************************************************/
  function logisticChoice(uPlan, uOpt) {
    const expPlan = Math.exp(uPlan);
    const expOpt = Math.exp(uOpt);
    return expPlan / (expPlan + expOpt);
  }

  /******************************************************
   * Display results -> update text + bar charts
   ******************************************************/
  function displayResults(label1, label2, pC1, pC2, planProb) {
    // membership
    classProbabilitiesEl.textContent = 
      `${label1}: ${(pC1*100).toFixed(2)}%\n` + 
      `${label2}: ${(pC2*100).toFixed(2)}%`;

    // uptake
    uptakeProbabilityEl.textContent = 
      `Probability of Plan Uptake (vs. Opt-Out): ${(planProb*100).toFixed(2)}%`;

    // Draw bar charts
    if (membershipChart) membershipChart.destroy();
    if (uptakeChart) uptakeChart.destroy();

    // membership bar chart
    membershipChart = new Chart(membershipCtx, {
      type: 'bar',
      data: {
        labels: [label1, label2],
        datasets: [{
          label: 'Class Membership (%)',
          data: [(pC1*100), (pC2*100)],
          backgroundColor: ['#3498db', '#f39c12']
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Percentage' }
          }
        },
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.parsed.x.toFixed(2)}%`;
              }
            }
          }
        }
      }
    });

    // uptake bar chart
    uptakeChart = new Chart(uptakeCtx, {
      type: 'bar',
      data: {
        labels: ['Plan Uptake Probability'],
        datasets: [{
          label: 'Probability (%)',
          data: [(planProb*100)],
          backgroundColor: ['#27ae60']
        }]
      },
      options: {
        indexAxis: 'y',
        scales: {
          x: {
            min: 0,
            max: 100,
            title: { display: true, text: 'Percentage' }
          }
        },
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return `${context.parsed.x.toFixed(2)}%`;
              }
            }
          }
        }
      }
    });
  }

  /******************************************************
   * Tab functionality
   ******************************************************/
  window.openTab = function(evt, tabName) {
    // Declare all variables
    var i, tabcontent, tablinks;

    // Get all elements with class="tabcontent" and hide them
    tabcontent = document.getElementsByClassName("tabcontent");
    for (i = 0; i < tabcontent.length; i++) {
      tabcontent[i].style.display = "none";
    }

    // Get all elements with class="tablinks" and remove the class "active"
    tablinks = document.getElementsByClassName("tablinks");
    for (i = 0; i < tablinks.length; i++) {
      tablinks[i].className = tablinks[i].className.replace(" active", "");
    }

    // Show the current tab, and add an "active" class to the button that opened the tab
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
  }

  // Get the element with id="defaultOpen" and click on it to open the default tab
  document.getElementById("defaultOpen").click();

});
