const tf = window.tf;

function generateElectricityData(samples = 1000) {
    const data = [];
    for (let i = 0; i < samples; i++) {
        const fridgeHours = 16 + Math.random() * 8;
        const geyserHours = Math.random() * 4;
        const tvHours = Math.random() * 8;
        const dailyKwh = fridgeHours * 0.1 + geyserHours * 4 + tvHours * 0.15;
        data.push([fridgeHours, geyserHours, tvHours, dailyKwh]);
    }
    return data;
}

function generateWaterData(samples = 1000) {
    const data = [];
    for (let i = 0; i < samples; i++) {
        const showerMinutes = Math.random() * 15;
        const dishMinutes = Math.random() * 20;
        const washingMachine = Math.random() * 2;
        const dailyLiters = showerMinutes * 9 + dishMinutes * 6 + washingMachine * 50;
        data.push([showerMinutes, dishMinutes, washingMachine, dailyLiters]);
    }
    return data;
}

function generateGasData(samples = 1000) {
    const data = [];
    for (let i = 0; i < samples; i++) {
        const stoveHours = Math.random() * 3;
        const heaterHours = Math.random() * 5;
        const ovenHours = Math.random() * 2;
        const dailyCubic = stoveHours * 0.03 + heaterHours * 0.05 + ovenHours * 0.04;
        data.push([stoveHours, heaterHours, ovenHours, dailyCubic]);
    }
    return data;
}

function normalize(tensor, min, max) {
    return tensor.sub(min).div(max.sub(min));
}

function createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 16, activation: 'relu', inputShape: [3] }));
    model.add(tf.layers.dense({ units: 8, activation: 'relu' }));
    model.add(tf.layers.dense({ units: 1 }));
    model.compile({ optimizer: 'adam', loss: 'meanSquaredError' });
    return model;
}

async function trainModel(type = 'electricity') {
    const outputDiv = document.getElementById('ai-result');
    if (!outputDiv) return;
    outputDiv.innerText = 'Please wait 15 seconds...';

    let data;
    if (type === 'water') data = generateWaterData();
    else if (type === 'gas') data = generateGasData();
    else data = generateElectricityData();

    const inputs = data.map(row => row.slice(0, 3));
    const outputs = data.map(row => [row[3]]);

    const inputTensor = tf.tensor2d(inputs);
    const outputTensor = tf.tensor2d(outputs);

    const inputMin = inputTensor.min(0);
    const inputMax = inputTensor.max(0);
    const outputMin = outputTensor.min();
    const outputMax = outputTensor.max();

    const normInputs = normalize(inputTensor, inputMin, inputMax);
    const normOutputs = normalize(outputTensor, outputMin, outputMax);

    const model = createModel();
    await model.fit(normInputs, normOutputs, {
        epochs: 32,
        batchSize: 32,
        shuffle: true
    });

    await model.save(`localstorage://${type}-model`);
    outputDiv.innerText = 'Now you can choose your duration.';

    inputTensor.dispose();
    outputTensor.dispose();
    normInputs.dispose();
    normOutputs.dispose();
}

async function predictUsage(option, duration) {
    const outputDiv = document.getElementById('ai-result');
    if (!outputDiv) return;

    const type = option === "2" ? 'water' : option === "3" ? 'gas' : 'electricity';
    outputDiv.innerText = 'Predicting...';

    let model;
    try {
        model = await tf.loadLayersModel(`localstorage://${type}-model`);
    } catch {
        await trainModel(type);
        model = await tf.loadLayersModel(`localstorage://${type}-model`);
    }

    let input, inputMin, inputMax, outputMin = 0, outputMax, rate;
    if (type === 'electricity') {
        const data = generateElectricityData();
        input = [[...Array(3)].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length)];
        inputMin = tf.tensor1d([16, 0, 0]);
        inputMax = tf.tensor1d([24, 4, 8]);
        outputMax = 24 * 0.1 + 4 * 4 + 8 * 0.15;
        rate = 1.17;
    } else if (type === 'water') {
        const data = generateWaterData();
        input = [[...Array(3)].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length)];
        inputMin = tf.tensor1d([0, 0, 0]);
        inputMax = tf.tensor1d([15, 20, 2]);
        outputMax = 15 * 9 + 20 * 6 + 2 * 50;
        rate = 40;
    } else {
        const data = generateGasData();
        input = [[...Array(3)].map((_, i) => data.reduce((sum, row) => sum + row[i], 0) / data.length)];
        inputMin = tf.tensor1d([0, 0, 0]);
        inputMax = tf.tensor1d([3, 5, 2]);
        outputMax = 3 * 0.03 + 5 * 0.05 + 2 * 0.04;
        rate = 0.02;
    }

    const inputTensor = tf.tensor2d(input);
    const normInput = normalize(inputTensor, inputMin, inputMax);
    const prediction = model.predict(normInput);
    const dailyUsage = prediction.dataSync()[0] * (outputMax - outputMin) + outputMin;

    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - new Date().getDate();
    let topUpAmount, durationLabel;

    const multiplier = duration === 'month' ? daysRemaining : duration;
    durationLabel = duration === 'month' ? '1 Month' : `${duration} Day${duration === 1 ? '' : 's'}`;
    topUpAmount = dailyUsage * multiplier / rate;

    document.getElementById('amount').value = topUpAmount.toFixed(2);
    outputDiv.innerText = `Predicted Daily ${type === 'electricity' ? 'kWh' : type === 'water' ? 'liters' : 'm³'}: ${dailyUsage.toFixed(2)}\n` +
                          `Top-Up for ${durationLabel}: R${topUpAmount.toFixed(2)} (auto-filled)`;

    inputTensor.dispose();
    normInput.dispose();
    prediction.dispose();
}

export { trainModel, predictUsage };

