/******************************************************
 * script.js - T2DM Decision Aid (Preference-Space)
 * ---------------------------------------------------
 * Features:
 * - Exact membership & utility coefficients for Exp1, Exp2, Exp3.
 * - Disables "others" inputs for Exp1 & Exp2.
 * - Interactive sliders with real-time value display.
 * - Bar charts for class memberships and plan uptake.
 * - Additional tabs for Instructions, WTP (with & without demographics), Comparison, and Saved Results.
 * - Save and compare results across experiments and scenarios.
 * - Export functionality for charts.
 ******************************************************/

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
  const saveBtn = document.getElementById('saveBtn');

  // Results
  const classProbabilitiesEl = document.getElementById('classProbabilities');
  const uptakeProbabilityEl = document.getElementById('uptakeProbability');

  // Chart contexts
  const membershipCtx = document.getElementById('membershipChart').getContext('2d');
  const uptakeCtx = document.getElementById('uptakeChart').getContext('2d');
  const wtpEfficacyCtxWithoutDemo = document.getElementById('wtpEfficacyChartWithoutDemo').getContext('2d');
  const wtpRiskCtxWithoutDemo = document.getElementById('wtpRiskChartWithoutDemo').getContext('2d');
  const wtpEfficacyCtxWithDemo = document.getElementById('wtpEfficacyChartWithDemo').getContext('2d');
  const wtpRiskCtxWithDemo = document.getElementById('wtpRiskChartWithDemo').getContext('2d');
  const wtpOthersCtxWithDemo = document.getElementById('wtpOthersChartWithDemo').getContext('2d');
  const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');

  // Download buttons
  const downloadWTPWithoutDemoBtn = document.getElementById('downloadWTPWithoutDemo');
  const downloadWTPWithDemoBtn = document.getElementById('downloadWTPWithDemo');
  const downloadComparisonBtn = document.getElementById('downloadComparison');

  // Comparison Controls
  const comparisonSelect = document.getElementById('comparisonSelect');
  const compareBtn = document.getElementById('compareBtn');

  // Charts
  let membershipChart;
  let uptakeChart;
  let wtpEfficacyChartWithoutDemo;
  let wtpRiskChartWithoutDemo;
  let wtpEfficacyChartWithDemo;
  let wtpRiskChartWithDemo;
  let wtpOthersChartWithDemo;
  let comparisonChart;

  // Saved Results
  const savedResultsList = document.getElementById('savedResultsList');
  const clearSavedBtn = document.getElementById('clearSavedBtn');

  // Initialize Charts
  initializeCharts();

  // Initialize Saved Results from localStorage
  loadSavedResults();

  /******************************************************
   * SLIDER LISTENERS - display their values in real-time
   ******************************************************/
  [efficacySelfEl, riskSelfEl, costSelfEl,
   efficacyOthersEl, riskOthersEl, costOthersEl].forEach(slider => {
    slider.addEventListener('input', () => {
      updateSliderValue(slider);
    });
  });

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
  saveBtn.addEventListener('click', saveCurrentResult);
  clearSavedBtn.addEventListener('click', clearSavedResults);
  downloadWTPWithoutDemoBtn.addEventListener('click', () => downloadChart('wtpEfficacyChartWithoutDemo'));
  downloadWTPWithDemoBtn.addEventListener('click', () => downloadChart('wtpEfficacyChartWithDemo'));
  downloadComparisonBtn.addEventListener('click', () => downloadChart('comparisonChart'));

  compareBtn.addEventListener('click', compareSelectedResults);

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
    const { pC1, pC2, label1, label2 } = getClassMembership(expChoice);

    // 2) Plan uptake
    const planProb = computePlanUptake(expChoice, pC1, pC2, effSelf, rSelf, cSelf, effOthers, rOthers, cOthers);

    // 3) Display
    displayResults(label1, label2, pC1, pC2, planProb);

    // 4) Update WTP Charts
    updateWTChartWithoutDemographics(expChoice);
    updateWTChartWithDemographics(expChoice, age, gender, race, income, degree, goodHealth);
  }

  /******************************************************
   * getClassMembership
   * Returns fixed class shares based on the experiment.
   ******************************************************/
  function getClassMembership(expChoice) {
    let pC1, pC2, label1, label2;

    if (expChoice === '1') {
      // Experiment 1
      pC1 = 68.5137;
      pC2 = 31.4863;
      label1 = "Class 1: Risk-Averse";
      label2 = "Class 2: Cost-Sensitive";
    }
    else if (expChoice === '2') {
      // Experiment 2
      pC1 = 71.2992;
      pC2 = 28.7008;
      label1 = "Class 1: Equity-Focused";
      label2 = "Class 2: Cost-Sensitive";
    }
    else {
      // Experiment 3
      pC1 = 72.2339;
      pC2 = 27.7661;
      label1 = "Class 1: Equity-Focused";
      label2 = "Class 2: Self-Focused";
    }

    return { pC1, pC2, label1, label2 };
  }

  /******************************************************
   * computePlanUptake
   * Correctly calculates plan uptake based on latent classes.
   ******************************************************/
  function computePlanUptake(expChoice, pC1, pC2, effS, rS, cS, effO, rO, cO) {
    let planProbC1 = 0;
    let planProbC2 = 0;

    if (expChoice === '1') {
      // Experiment 1 - Only Self
      // Class 1 (Risk-Averse)
      const uPlan_C1 = -0.1484
        + 1.6944 * effS
        + (-1.8439) * rS
        + (-0.0650) * cS;
      const uOptOut_C1 = -1.7885;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Cost-Sensitive)
      const uPlan_C2 = -0.1010
        + 2.7260 * effS
        + (-2.0641) * rS
        + (-0.3963) * cS;
      const uOptOut_C2 = 0.9865;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);
    }
    else if (expChoice === '2') {
      // Experiment 2 - Self & Others, Equal Outcomes
      // Class 1 (Equity-Focused)
      const uPlan_C1 = -0.0772
        + 1.9771 * effS
        + (-1.3736) * rS
        + (-0.0940) * cS;
      const uOptOut_C1 = -1.7062;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Cost-Sensitive)
      const uPlan_C2 = 0.0654
        + 2.5939 * effS
        + 0.0550 * rS
        + (-0.3627) * cS;
      const uOptOut_C2 = 1.6773;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);
    }
    else {
      // Experiment 3 - Self vs Others, Unequal Outcomes
      // Class 1 (Equity-Focused)
      const uPlan_C1 = -0.0318
        + 1.3070 * effS
        + (-0.6877) * rS
        + (-0.0393) * cS
        + 0.5063 * effO
        + (-0.8702) * rO
        + (-0.0352) * cO;
      const uOptOut_C1 = -1.6011;
      planProbC1 = logisticChoice(uPlan_C1, uOptOut_C1);

      // Class 2 (Self-Focused)
      const uPlan_C2 = -0.2911
        + 2.5028 * effS
        + (-2.3606) * rS
        + (-0.3527) * cS
        + 0.5076 * effO
        + 0.1003 * rO
        + (-0.0794) * cO;
      const uOptOut_C2 = 1.4660;
      planProbC2 = logisticChoice(uPlan_C2, uOptOut_C2);
    }

    // Weighted final
    const overallPlanProb = (pC1 * planProbC1) + (pC2 * planProbC2);

    // Ensure it's between 0 and 100
    return Math.min(Math.max(overallPlanProb * 100, 0), 100);
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
    // Display class probabilities
    classProbabilitiesEl.textContent = 
      `${label1}: ${pC1.toFixed(2)}%\n` + 
      `${label2}: ${pC2.toFixed(2)}%`;

    // Display plan uptake probability
    uptakeProbabilityEl.textContent = 
      `Predicted Health Plan Uptake: ${planProb.toFixed(2)}%`;

    // Draw or Update membership bar chart
    if (membershipChart) {
      membershipChart.data.labels = [label1, label2];
      membershipChart.data.datasets[0].data = [pC1, pC2];
      membershipChart.update();
    } else {
      membershipChart = new Chart(membershipCtx, {
        type: 'bar',
        data: {
          labels: [label1, label2],
          datasets: [{
            label: 'Class Membership (%)',
            data: [pC1, pC2],
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
    }

    // Draw or Update uptake bar chart
    if (uptakeChart) {
      uptakeChart.data.datasets[0].data = [planProb];
      uptakeChart.update();
    } else {
      uptakeChart = new Chart(uptakeCtx, {
        type: 'bar',
        data: {
          labels: ['Predicted Health Plan Uptake'],
          datasets: [{
            label: 'Probability (%)',
            data: [planProb],
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
  }

  /******************************************************
   * Initialize Charts
   ******************************************************/
  function initializeCharts() {
    // Initialize empty charts
    membershipChart = null;
    uptakeChart = null;
    wtpEfficacyChartWithoutDemo = null;
    wtpRiskChartWithoutDemo = null;
    wtpEfficacyChartWithDemo = null;
    wtpRiskChartWithDemo = null;
    wtpOthersChartWithDemo = null;
    comparisonChart = null;
  }

  /******************************************************
   * Update WTP Charts Without Demographics
   * Class-specific WTP calculations in dollars with error bars.
   ******************************************************/
  function updateWTChartWithoutDemographics(expChoice) {
    const WTP_Data = getWTP(expChoice);

    // WTP for Efficacy
    const wtpEfficacyData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Efficacy ($/%)',
        data: [WTP_Data.class1.efficacy.wtp, WTP_Data.class2.efficacy.wtp],
        backgroundColor: ['#8e44ad', '#e67e22'],
        errorBars: {
          color: '#000',
          values: [WTP_Data.class1.efficacy.se, WTP_Data.class2.efficacy.se]
        }
      }]
    };

    const wtpEfficacyOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          colors: {
            default: '#000'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.efficacy.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // WTP for Risk
    const wtpRiskData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Risk Reduction ($/%)',
        data: [WTP_Data.class1.risk.wtp, WTP_Data.class2.risk.wtp],
        backgroundColor: ['#e74c3c', '#3498db'],
        errorBars: {
          color: '#000',
          values: [WTP_Data.class1.risk.se, WTP_Data.class2.risk.se]
        }
      }]
    };

    const wtpRiskOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          colors: {
            default: '#000'
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.risk.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // Draw or Update WTP Efficacy Chart Without Demographics
    if (wtpEfficacyChartWithoutDemo) {
      wtpEfficacyChartWithoutDemo.data = wtpEfficacyData;
      wtpEfficacyChartWithoutDemo.options = wtpEfficacyOptions;
      wtpEfficacyChartWithoutDemo.update();
    } else {
      wtpEfficacyChartWithoutDemo = new Chart(wtpEfficacyCtxWithoutDemo, {
        type: 'barWithError',
        data: wtpEfficacyData,
        options: wtpEfficacyOptions,
        plugins: [Chart.registry.getPlugin('errorBars')]
      });
    }

    // Draw or Update WTP Risk Chart Without Demographics
    if (wtpRiskChartWithoutDemo) {
      wtpRiskChartWithoutDemo.data = wtpRiskData;
      wtpRiskChartWithoutDemo.options = wtpRiskOptions;
      wtpRiskChartWithoutDemo.update();
    } else {
      wtpRiskChartWithoutDemo = new Chart(wtpRiskCtxWithoutDemo, {
        type: 'barWithError',
        data: wtpRiskData,
        options: wtpRiskOptions,
        plugins: [Chart.registry.getPlugin('errorBars')]
      });
    }
  }

  /******************************************************
   * Update WTP Charts With Demographics
   * Class-specific WTP calculations in dollars with error bars.
   * Incorporates demographic variables into WTP if applicable.
   ******************************************************/
  function updateWTChartWithDemographics(expChoice, age, gender, race, income, degree, goodHealth) {
    // For demonstration purposes, this function mirrors the Without Demographics WTP.
    // To incorporate demographics into WTP, you'd need a specific formula or model.
    // Here, we'll assume demographics do not affect WTP directly.
    // Implement this function based on your specific requirements.

    // Placeholder: Same as Without Demographics
    updateWTChartWithoutDemographics(expChoice);

    // Additionally, for Experiment 3, include WTP for Others
    if (expChoice === '3') {
      const WTP_Data = getWTP(expChoice);

      const wtpOthersData = {
        labels: ["Class 1", "Class 2"],
        datasets: [{
          label: 'WTP for Others ($/%)',
          data: [WTP_Data.class1.others.wtp, WTP_Data.class2.others.wtp],
          backgroundColor: ['#16a085', '#d35400'],
          errorBars: {
            color: '#000',
            values: [WTP_Data.class1.others.se, WTP_Data.class2.others.se]
          }
        }]
      };

      const wtpOthersOptions = {
        plugins: {
          legend: { display: false },
          errorBars: {
            colors: {
              default: '#000'
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const index = context.dataIndex;
                const value = context.parsed.y.toFixed(2);
                const error = WTP_Data.class1.others.se.toFixed(2);
                return `WTP: $${value} ± $${error}`;
              }
            }
          }
        },
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'WTP ($/%)' }
          }
        }
      };

      // Draw or Update WTP Others Chart With Demographics
      if (wtpOthersChartWithDemo) {
        wtpOthersChartWithDemo.data = wtpOthersData;
        wtpOthersChartWithDemo.options = wtpOthersOptions;
        wtpOthersChartWithDemo.update();
      } else {
        wtpOthersChartWithDemo = new Chart(wtpOthersCtxWithDemo, {
          type: 'barWithError',
          data: wtpOthersData,
          options: wtpOthersOptions,
          plugins: [Chart.registry.getPlugin('errorBars')]
        });
      }
    } else {
      // Hide the WTP for Others chart if not applicable
      if (wtpOthersChartWithDemo) {
        wtpOthersChartWithDemo.destroy();
        wtpOthersChartWithDemo = null;
      }
    }
  }

  /******************************************************
   * Get WTP Data
   * Returns WTP and standard errors for each class and attribute.
   ******************************************************/
  function getWTP(expChoice) {
    // Define coefficients and standard errors for each experiment and class
    const data = {
      '1': { // Experiment 1
        class1: {
          efficacy: { coef: 1.6944, se: 0.0875 },
          risk: { coef: -1.8439, se: 0.2443 },
          cost: { coef: -0.0650, se: 0.0075 }
        },
        class2: {
          efficacy: { coef: 2.7260, se: 0.2197 },
          risk: { coef: -2.0641, se: 0.7201 },
          cost: { coef: -0.3963, se: 0.0371 }
        }
      },
      '2': { // Experiment 2
        class1: {
          efficacy: { coef: 1.9771, se: 0.0858 },
          risk: { coef: -1.3736, se: 0.2288 },
          cost: { coef: -0.0940, se: 0.0076 }
        },
        class2: {
          efficacy: { coef: 2.5939, se: 0.2377 },
          risk: { coef: 0.0550, se: 0.7263 },
          cost: { coef: -0.3627, se: 0.0325 }
        }
      },
      '3': { // Experiment 3
        class1: {
          efficacy: { coef: 1.3070, se: 0.0845 },
          risk: { coef: -0.6877, se: 0.3073 },
          cost: { coef: -0.0393, se: 0.0070 },
          others: { coef: 0.5063, se: 0.0838 }
        },
        class2: {
          efficacy: { coef: 2.5028, se: 0.3107 },
          risk: { coef: -2.3606, se: 0.8912 },
          cost: { coef: -0.3527, se: 0.0435 },
          others: { coef: 0.5076, se: 0.3285 }
        }
      }
    };

    const expData = data[expChoice];

    // Calculate WTP for efficacy and risk for each class
    const WTP_Class1_Efficacy = expData.class1.efficacy.coef / (-expData.class1.cost.coef);
    const WTP_Class1_Risk = expData.class1.risk.coef / (-expData.class1.cost.coef);
    const WTP_Class2_Efficacy = expData.class2.efficacy.coef / (-expData.class2.cost.coef);
    const WTP_Class2_Risk = expData.class2.risk.coef / (-expData.class2.cost.coef);

    // Calculate WTP for others in Experiment 3
    let WTP_Class1_Others = 0;
    let WTP_Class2_Others = 0;
    if (expChoice === '3') {
      WTP_Class1_Others = expData.class1.others.coef / (-expData.class1.cost.coef);
      WTP_Class2_Others = expData.class2.others.coef / (-expData.class2.cost.coef);
    }

    // Calculate standard errors using the delta method
    const WTP_Class1_Efficacy_SE = Math.sqrt(
      Math.pow(expData.class1.efficacy.se / (-expData.class1.cost.coef), 2) +
      Math.pow((expData.class1.efficacy.coef * expData.class1.cost.se) / (Math.pow(expData.class1.cost.coef, 2)), 2)
    );

    const WTP_Class1_Risk_SE = Math.sqrt(
      Math.pow(expData.class1.risk.se / (-expData.class1.cost.coef), 2) +
      Math.pow((expData.class1.risk.coef * expData.class1.cost.se) / (Math.pow(expData.class1.cost.coef, 2)), 2)
    );

    const WTP_Class2_Efficacy_SE = Math.sqrt(
      Math.pow(expData.class2.efficacy.se / (-expData.class2.cost.coef), 2) +
      Math.pow((expData.class2.efficacy.coef * expData.class2.cost.se) / (Math.pow(expData.class2.cost.coef, 2)), 2)
    );

    const WTP_Class2_Risk_SE = Math.sqrt(
      Math.pow(expData.class2.risk.se / (-expData.class2.cost.coef), 2) +
      Math.pow((expData.class2.risk.coef * expData.class2.cost.se) / (Math.pow(expData.class2.cost.coef, 2)), 2)
    );

    // For Experiment 3, calculate WTP for others
    let WTP_Class1_Others_SE = 0;
    let WTP_Class2_Others_SE = 0;
    if (expChoice === '3') {
      WTP_Class1_Others_SE = Math.sqrt(
        Math.pow(expData.class1.others.se / (-expData.class1.cost.coef), 2) +
        Math.pow((expData.class1.others.coef * expData.class1.cost.se) / (Math.pow(expData.class1.cost.coef, 2)), 2)
      );

      WTP_Class2_Others_SE = Math.sqrt(
        Math.pow(expData.class2.others.se / (-expData.class2.cost.coef), 2) +
        Math.pow((expData.class2.others.coef * expData.class2.cost.se) / (Math.pow(expData.class2.cost.coef, 2)), 2)
      );
    }

    return {
      class1: {
        efficacy: { wtp: WTP_Class1_Efficacy, se: WTP_Class1_Efficacy_SE },
        risk: { wtp: WTP_Class1_Risk, se: WTP_Class1_Risk_SE },
        others: { wtp: WTP_Class1_Others, se: WTP_Class1_Others_SE }
      },
      class2: {
        efficacy: { wtp: WTP_Class2_Efficacy, se: WTP_Class2_Efficacy_SE },
        risk: { wtp: WTP_Class2_Risk, se: WTP_Class2_Risk_SE },
        others: { wtp: WTP_Class2_Others, se: WTP_Class2_Others_SE }
      }
    };
  }

  /******************************************************
   * Update WTP Charts Without Demographics
   * Class-specific WTP calculations in dollars with error bars.
   ******************************************************/
  function updateWTChartWithoutDemographics(expChoice) {
    const WTP_Data = getWTP(expChoice);

    // WTP for Efficacy
    const wtpEfficacyData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Efficacy ($/%)',
        data: [WTP_Data.class1.efficacy.wtp, WTP_Data.class2.efficacy.wtp],
        backgroundColor: ['#8e44ad', '#e67e22'],
        errorBarColor: '#000',
        errorBarThickness: 1,
        errorBarValues: [WTP_Data.class1.efficacy.se, WTP_Data.class2.efficacy.se]
      }]
    };

    const wtpEfficacyOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          display: true,
          color: '#000',
          thickness: 2,
          // Chart.js Error Bars Plugin expects `errorBarData` as an array of objects
          errorBarData: {
            datasets: [{
              x: [0,1],
              y: [WTP_Data.class1.efficacy.wtp, WTP_Data.class2.efficacy.wtp],
              error: [WTP_Data.class1.efficacy.se, WTP_Data.class2.efficacy.se],
              borderColor: '#000',
              borderWidth: 1,
              capWidth: 5,
              lineWidth: 1
            }]
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.efficacy.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // WTP for Risk
    const wtpRiskData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Risk Reduction ($/%)',
        data: [WTP_Data.class1.risk.wtp, WTP_Data.class2.risk.wtp],
        backgroundColor: ['#e74c3c', '#3498db'],
        errorBarColor: '#000',
        errorBarThickness: 1,
        errorBarValues: [WTP_Data.class1.risk.se, WTP_Data.class2.risk.se]
      }]
    };

    const wtpRiskOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          display: true,
          color: '#000',
          thickness: 2,
          errorBarData: {
            datasets: [{
              x: [0,1],
              y: [WTP_Data.class1.risk.wtp, WTP_Data.class2.risk.wtp],
              error: [WTP_Data.class1.risk.se, WTP_Data.class2.risk.se],
              borderColor: '#000',
              borderWidth: 1,
              capWidth: 5,
              lineWidth: 1
            }]
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.risk.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // Draw or Update WTP Efficacy Chart Without Demographics
    if (wtpEfficacyChartWithoutDemo) {
      wtpEfficacyChartWithoutDemo.data = wtpEfficacyData;
      wtpEfficacyChartWithoutDemo.options = wtpEfficacyOptions;
      wtpEfficacyChartWithoutDemo.update();
    } else {
      wtpEfficacyChartWithoutDemo = new Chart(wtpEfficacyCtxWithoutDemo, {
        type: 'bar',
        data: wtpEfficacyData,
        options: wtpEfficacyOptions
      });
    }

    // Draw or Update WTP Risk Chart Without Demographics
    if (wtpRiskChartWithoutDemo) {
      wtpRiskChartWithoutDemo.data = wtpRiskData;
      wtpRiskChartWithoutDemo.options = wtpRiskOptions;
      wtpRiskChartWithoutDemo.update();
    } else {
      wtpRiskChartWithoutDemo = new Chart(wtpRiskCtxWithoutDemo, {
        type: 'bar',
        data: wtpRiskData,
        options: wtpRiskOptions
      });
    }
  }

  /******************************************************
   * Update WTP Charts With Demographics
   * Class-specific WTP calculations in dollars with error bars.
   * Incorporates demographic variables into WTP if applicable.
   ******************************************************/
  function updateWTChartWithDemographics(expChoice, age, gender, race, income, degree, goodHealth) {
    const WTP_Data = getWTP(expChoice);

    // WTP for Efficacy
    const wtpEfficacyData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Efficacy ($/%)',
        data: [WTP_Data.class1.efficacy.wtp, WTP_Data.class2.efficacy.wtp],
        backgroundColor: ['#8e44ad', '#e67e22']
      }]
    };

    const wtpEfficacyOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          display: true,
          color: '#000',
          thickness: 2,
          errorBarData: {
            datasets: [{
              x: [0,1],
              y: [WTP_Data.class1.efficacy.wtp, WTP_Data.class2.efficacy.wtp],
              error: [WTP_Data.class1.efficacy.se, WTP_Data.class2.efficacy.se],
              borderColor: '#000',
              borderWidth: 1,
              capWidth: 5,
              lineWidth: 1
            }]
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.efficacy.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // WTP for Risk
    const wtpRiskData = {
      labels: ["Class 1", "Class 2"],
      datasets: [{
        label: 'WTP for Risk Reduction ($/%)',
        data: [WTP_Data.class1.risk.wtp, WTP_Data.class2.risk.wtp],
        backgroundColor: ['#e74c3c', '#3498db']
      }]
    };

    const wtpRiskOptions = {
      plugins: {
        legend: { display: false },
        errorBars: {
          display: true,
          color: '#000',
          thickness: 2,
          errorBarData: {
            datasets: [{
              x: [0,1],
              y: [WTP_Data.class1.risk.wtp, WTP_Data.class2.risk.wtp],
              error: [WTP_Data.class1.risk.se, WTP_Data.class2.risk.se],
              borderColor: '#000',
              borderWidth: 1,
              capWidth: 5,
              lineWidth: 1
            }]
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const index = context.dataIndex;
              const value = context.parsed.y.toFixed(2);
              const error = WTP_Data.class1.risk.se.toFixed(2);
              return `WTP: $${value} ± $${error}`;
            }
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'WTP ($/%)' }
        }
      }
    };

    // WTP for Others (Only in Experiment 3)
    let wtpOthersData = null;
    let wtpOthersOptions = null;

    if (expChoice === '3') {
      wtpOthersData = {
        labels: ["Class 1", "Class 2"],
        datasets: [{
          label: 'WTP for Others ($/%)',
          data: [WTP_Data.class1.others.wtp, WTP_Data.class2.others.wtp],
          backgroundColor: ['#16a085', '#d35400']
        }]
      };

      wtpOthersOptions = {
        plugins: {
          legend: { display: false },
          errorBars: {
            display: true,
            color: '#000',
            thickness: 2,
            errorBarData: {
              datasets: [{
                x: [0,1],
                y: [WTP_Data.class1.others.wtp, WTP_Data.class2.others.wtp],
                error: [WTP_Data.class1.others.se, WTP_Data.class2.others.se],
                borderColor: '#000',
                borderWidth: 1,
                capWidth: 5,
                lineWidth: 1
              }]
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const index = context.dataIndex;
                const value = context.parsed.y.toFixed(2);
                const error = WTP_Data.class1.others.se.toFixed(2);
                return `WTP: $${value} ± $${error}`;
              }
            }
          }
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'WTP ($/%)' }
          }
        }
      };
    }

    // Draw or Update WTP Efficacy Chart With Demographics
    if (wtpEfficacyChartWithDemo) {
      wtpEfficacyChartWithDemo.data = wtpEfficacyData;
      wtpEfficacyChartWithDemo.options = wtpEfficacyOptions;
      wtpEfficacyChartWithDemo.update();
    } else {
      wtpEfficacyChartWithDemo = new Chart(wtpEfficacyCtxWithDemo, {
        type: 'bar',
        data: wtpEfficacyData,
        options: wtpEfficacyOptions
      });
    }

    // Draw or Update WTP Risk Chart With Demographics
    if (wtpRiskChartWithDemo) {
      wtpRiskChartWithDemo.data = wtpRiskData;
      wtpRiskChartWithDemo.options = wtpRiskOptions;
      wtpRiskChartWithDemo.update();
    } else {
      wtpRiskChartWithDemo = new Chart(wtpRiskCtxWithDemo, {
        type: 'bar',
        data: wtpRiskData,
        options: wtpRiskOptions
      });
    }

    // Draw or Update WTP Others Chart With Demographics (Only in Exp3)
    if (expChoice === '3') {
      if (wtpOthersChartWithDemo) {
        wtpOthersChartWithDemo.data = wtpOthersData;
        wtpOthersChartWithDemo.options = wtpOthersOptions;
        wtpOthersChartWithDemo.update();
      } else {
        wtpOthersChartWithDemo = new Chart(wtpOthersCtxWithDemo, {
          type: 'bar',
          data: wtpOthersData,
          options: wtpOthersOptions
        });
      }
    } else {
      // Hide the WTP for Others chart if not applicable
      if (wtpOthersChartWithDemo) {
        wtpOthersChartWithDemo.destroy();
        wtpOthersChartWithDemo = null;
      }
    }
  }

  /******************************************************
   * Save Current Result
   ******************************************************/
  function saveCurrentResult() {
    // Gather current inputs and results
    const age = document.getElementById('age').value;
    const gender = document.getElementById('gender').value;
    const race = document.getElementById('race').value;
    const income = document.getElementById('income').value;
    const degree = document.getElementById('degree').value;
    const goodHealth = document.getElementById('goodHealth').value;
    const experiment = document.getElementById('experiment').value;

    const effSelf = efficacySelfEl.value;
    const rSelf = riskSelfEl.value;
    const cSelf = costSelfEl.value;
    const effOthers = efficacyOthersEl.value;
    const rOthers = riskOthersEl.value;
    const cOthers = costOthersEl.value;

    const classProbText = classProbabilitiesEl.textContent;
    const uptakeProbText = uptakeProbabilityEl.textContent;

    if (!classProbText || !uptakeProbText) {
      alert("Please predict the plan uptake before saving the result.");
      return;
    }

    const timestamp = new Date().toLocaleString();

    const savedResult = {
      timestamp,
      age,
      gender,
      race,
      income,
      degree,
      goodHealth,
      experiment,
      effSelf,
      rSelf,
      cSelf,
      effOthers,
      rOthers,
      cOthers,
      classProbText,
      uptakeProbText
    };

    // Get existing saved results from localStorage
    let savedResults = JSON.parse(localStorage.getItem('savedResults')) || [];

    // Add new result
    savedResults.push(savedResult);

    // Save back to localStorage
    localStorage.setItem('savedResults', JSON.stringify(savedResults));

    // Update the UI
    addSavedResultToList(savedResult);

    // Update comparison select
    addOptionToComparisonSelect(savedResult);

    alert("Result saved successfully!");
  }

  /******************************************************
   * Load Saved Results from localStorage
   ******************************************************/
  function loadSavedResults() {
    let savedResults = JSON.parse(localStorage.getItem('savedResults')) || [];

    savedResults.forEach(result => {
      addSavedResultToList(result);
      addOptionToComparisonSelect(result);
    });
  }

  /******************************************************
   * Add Saved Result to the List
   ******************************************************/
  function addSavedResultToList(result) {
    const li = document.createElement('li');
    li.textContent = `${result.timestamp} - Exp ${result.experiment}`;
    
    const viewBtn = document.createElement('button');
    viewBtn.textContent = "View";
    viewBtn.addEventListener('click', () => {
      displaySavedResult(result);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = "Delete";
    deleteBtn.style.marginLeft = "10px";
    deleteBtn.addEventListener('click', () => {
      deleteSavedResult(result.timestamp);
    });

    li.appendChild(viewBtn);
    li.appendChild(deleteBtn);
    savedResultsList.appendChild(li);
  }

  /******************************************************
   * Add Option to Comparison Select
   ******************************************************/
  function addOptionToComparisonSelect(result) {
    const option = document.createElement('option');
    option.value = result.timestamp;
    option.textContent = `${result.timestamp} - Exp ${result.experiment}`;
    comparisonSelect.appendChild(option);
  }

  /******************************************************
   * Display Saved Result in Comparison Chart
   ******************************************************/
  function displaySavedResult(result) {
    // Extract plan uptake probability
    const uptakeMatch = result.uptakeProbText.match(/Predicted Health Plan Uptake: (\d+(\.\d+)?)%/);
    const uptake = uptakeMatch ? parseFloat(uptakeMatch[1]) : 0;

    // Extract class probabilities
    const classMatch = result.classProbText.match(/(Class 1: [^:]+): (\d+(\.\d+)?)%\n(Class 2: [^:]+): (\d+(\.\d+)?)%/);
    let class1Label = "Class 1";
    let class2Label = "Class 2";
    let class1Prob = 0;
    let class2Prob = 0;
    if (classMatch) {
      class1Label = classMatch[1];
      class1Prob = parseFloat(classMatch[2]);
      class2Label = classMatch[4];
      class2Prob = parseFloat(classMatch[5]);
    }

    // Add data to comparison chart
    if (!comparisonChart) {
      comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
          labels: [class1Label, class2Label, 'Predicted Uptake'],
          datasets: []
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          scales: {
            x: {
              min: 0,
              max: 100,
              title: { display: true, text: 'Percentage' }
            }
          },
          plugins: {
            legend: { display: true },
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

    const color = getRandomColor();
    comparisonChart.data.datasets.push({
      label: result.timestamp,
      data: [class1Prob, class2Prob, uptake],
      backgroundColor: color
    });

    comparisonChart.update();
  }

  /******************************************************
   * Delete Saved Result
   ******************************************************/
  function deleteSavedResult(timestamp) {
    let savedResults = JSON.parse(localStorage.getItem('savedResults')) || [];
    savedResults = savedResults.filter(result => result.timestamp !== timestamp);
    localStorage.setItem('savedResults', JSON.stringify(savedResults));

    // Refresh the list
    savedResultsList.innerHTML = '';
    savedResults.forEach(result => {
      addSavedResultToList(result);
    });

    // Refresh comparison select
    comparisonSelect.innerHTML = '';
    savedResults.forEach(result => {
      addOptionToComparisonSelect(result);
    });

    // Remove from comparison chart
    removeFromComparisonChart(timestamp);

    alert("Saved result deleted.");
  }

  /******************************************************
   * Remove Deleted Result from Comparison Chart
   ******************************************************/
  function removeFromComparisonChart(timestamp) {
    if (!comparisonChart) return;

    // Find the dataset index by label (timestamp)
    const datasetIndex = comparisonChart.data.datasets.findIndex(ds => ds.label === timestamp);
    if (datasetIndex !== -1) {
      comparisonChart.data.datasets.splice(datasetIndex, 1);
      comparisonChart.update();
    }
  }

  /******************************************************
   * Clear All Saved Results
   ******************************************************/
  function clearSavedResults() {
    if (confirm("Are you sure you want to clear all saved results?")) {
      localStorage.removeItem('savedResults');
      savedResultsList.innerHTML = '';
      comparisonSelect.innerHTML = '';
      if (comparisonChart) {
        comparisonChart.data.datasets = [];
        comparisonChart.update();
      }
      alert("All saved results have been cleared.");
    }
  }

  /******************************************************
   * Generate Random Color for Comparison Chart
   ******************************************************/
  function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++ ) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  /******************************************************
   * Tab Functionality for Additional Tabs
   ******************************************************/
  window.openAdditionalTab = function(evt, tabName) {
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

  // Set default active tab to Instructions
  document.getElementById("instructionsTab").click();

  /******************************************************
   * Compare Selected Saved Results
   ******************************************************/
  function compareSelectedResults() {
    const selectedOptions = Array.from(comparisonSelect.selectedOptions);
    if (selectedOptions.length === 0) {
      alert("Please select at least one saved result to compare.");
      return;
    }

    if (!comparisonChart) {
      comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
          labels: ['Class 1', 'Class 2', 'Predicted Uptake'],
          datasets: []
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          scales: {
            x: {
              min: 0,
              max: 100,
              title: { display: true, text: 'Percentage' }
            }
          },
          plugins: {
            legend: { display: true },
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
    } else {
      // Reset comparison chart datasets
      comparisonChart.data.datasets = [];
    }

    selectedOptions.forEach(option => {
      const timestamp = option.value;
      const savedResults = JSON.parse(localStorage.getItem('savedResults')) || [];
      const result = savedResults.find(r => r.timestamp === timestamp);
      if (result) {
        // Extract plan uptake probability
        const uptakeMatch = result.uptakeProbText.match(/Predicted Health Plan Uptake: (\d+(\.\d+)?)%/);
        const uptake = uptakeMatch ? parseFloat(uptakeMatch[1]) : 0;

        // Extract class probabilities
        const classMatch = result.classProbText.match(/(Class 1: [^:]+): (\d+(\.\d+)?)%\n(Class 2: [^:]+): (\d+(\.\d+)?)%/);
        let class1Label = "Class 1";
        let class2Label = "Class 2";
        let class1Prob = 0;
        let class2Prob = 0;
        if (classMatch) {
          class1Label = classMatch[1];
          class1Prob = parseFloat(classMatch[2]);
          class2Label = classMatch[4];
          class2Prob = parseFloat(classMatch[5]);
        }

        // Add data to comparison chart
        const color = getRandomColor();
        comparisonChart.data.datasets.push({
          label: result.timestamp,
          data: [class1Prob, class2Prob, uptake],
          backgroundColor: color
        });
      }
    });

    comparisonChart.update();
  }

  /******************************************************
   * Export Chart as Image or PDF
   ******************************************************/
  function downloadChart(chartId) {
    const chart = Chart.getChart(chartId);
    if (!chart) {
      alert("No chart available to download.");
      return;
    }

    const link = document.createElement('a');
    link.href = chart.toBase64Image();
    link.download = `${chartId}.png`;
    link.click();
  }

});
