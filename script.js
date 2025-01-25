/******************************************************
 * script.js - T2DM Decision Aid (Preference-Space)
 * ---------------------------------------------------
 * Features:
 * - Exact membership & utility coefficients for Exp1, Exp2, Exp3.
 * - Disables "others" inputs for Exp1 & Exp2.
 * - Interactive sliders with real-time value display.
 * - Bar charts for class memberships and plan uptake.
 * - Additional tabs for WTP, Comparison, and Saved Results.
 * - Save and compare results across experiments and scenarios.
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
  const wtpCtx = document.getElementById('wtpChart').getContext('2d');
  const comparisonCtx = document.getElementById('comparisonChart').getContext('2d');

  // Charts
  let membershipChart;
  let uptakeChart;
  let wtpChart;
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

    // 4) Update WTP Chart
    updateWTChart(planProb);

    // 5) Update Comparison Chart if already populated
    // (Optional: Implementation can vary based on requirements)
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

    // Calculate probabilities
    const pClass1 = Math.exp(xBeta) / (1 + Math.exp(xBeta));
    const pClass2 = 1 - pClass1;

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
    // Display class probabilities
    classProbabilitiesEl.textContent = 
      `${label1}: ${(pC1*100).toFixed(2)}%\n` + 
      `${label2}: ${(pC2*100).toFixed(2)}%`;

    // Display plan uptake probability
    uptakeProbabilityEl.textContent = 
      `Probability of Plan Uptake (vs. Opt-Out): ${(planProb*100).toFixed(2)}%`;

    // Draw or Update membership bar chart
    if (membershipChart) {
      membershipChart.data.datasets[0].data = [(pC1*100), (pC2*100)];
      membershipChart.update();
    } else {
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
    }

    // Draw or Update uptake bar chart
    if (uptakeChart) {
      uptakeChart.data.datasets[0].data = [(planProb*100)];
      uptakeChart.update();
    } else {
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
  }

  /******************************************************
   * Initialize Charts
   ******************************************************/
  function initializeCharts() {
    // Initialize empty charts
    membershipChart = null;
    uptakeChart = null;
    wtpChart = null;
    comparisonChart = null;
  }

  /******************************************************
   * Update WTP Chart
   ******************************************************/
  function updateWTChart(planProb) {
    if (wtpChart) {
      wtpChart.data.datasets[0].data = [planProb * 100];
      wtpChart.update();
    } else {
      wtpChart = new Chart(wtpCtx, {
        type: 'bar',
        data: {
          labels: ['Plan Uptake Probability'],
          datasets: [{
            label: 'Probability (%)',
            data: [planProb * 100],
            backgroundColor: ['#8e44ad']
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

    alert("Result saved successfully!");
  }

  /******************************************************
   * Load Saved Results from localStorage
   ******************************************************/
  function loadSavedResults() {
    let savedResults = JSON.parse(localStorage.getItem('savedResults')) || [];

    savedResults.forEach(result => {
      addSavedResultToList(result);
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
   * Display Saved Result in Comparison Chart
   ******************************************************/
  function displaySavedResult(result) {
    // Extract plan uptake probability
    const uptakeMatch = result.uptakeProbText.match(/([\d.]+)%/);
    const uptake = uptakeMatch ? parseFloat(uptakeMatch[1]) : 0;

    // Extract class probabilities
    const classMatch = result.classProbText.match(/(Class 1: [^:]+): ([\d.]+)%\n(Class 2: [^:]+): ([\d.]+)%/);
    let class1Label = "Class 1";
    let class2Label = "Class 2";
    let class1Prob = 0;
    let class2Prob = 0;
    if (classMatch) {
      class1Label = classMatch[1];
      class1Prob = parseFloat(classMatch[2]);
      class2Label = classMatch[3];
      class2Prob = parseFloat(classMatch[4]);
    }

    // Add data to comparison chart
    if (!comparisonChart) {
      comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
          labels: [class1Label, class2Label, 'Plan Uptake'],
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

    alert("Saved result deleted.");
  }

  /******************************************************
   * Clear All Saved Results
   ******************************************************/
  function clearSavedResults() {
    if (confirm("Are you sure you want to clear all saved results?")) {
      localStorage.removeItem('savedResults');
      savedResultsList.innerHTML = '';
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

});
