// Create the Leaflet map
let myMap = L.map("map", {
  center: [37.7749, -122.4194],
  zoom: 13
});

// Adding the tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(myMap);

// D3 to get the JSON data
d3.json("https://data.sfgov.org/resource/pyih-qa8i.json").then(function(data) {
  // Filter out businesses without zip codes or inspection scores
  let filteredData = data.filter(item => item.business_postal_code && item.inspection_score !== undefined);

  // Create an object to hold the inspection scores for each zip code
  let inspectionScores = {};

  // Iterate over the filtered data and store inspection scores by zip code
  filteredData.forEach(item => {
    let zipCode = item.business_postal_code;
    let inspectionScore = parseFloat(item.inspection_score);

    // Check if the zip code exists in the inspectionScores object
    if (zipCode in inspectionScores) {
      inspectionScores[zipCode].push(inspectionScore);
    } else {
      inspectionScores[zipCode] = [inspectionScore];
    }
  });

  // Output inspection score averages and all inspection scores
  Object.entries(inspectionScores).forEach(([zipCode, scores]) => {
    let average = Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
    inspectionScores[zipCode] = average; // Update inspectionScores object with rounded average score
    console.log(`Zip Code: ${zipCode}, Average Inspection Score: ${average}`);
    console.log(`Inspection Scores for ${zipCode}: ${scores}`);
  });
  

  // D3 to get the JSON data
  d3.json("https://data.sfgov.org/resource/srq6-hmpi.json").then(function(jsonData) {
    // Convert JSON data to GeoJSON format
    let geojson = {
      type: "FeatureCollection",
      features: jsonData.map(item => {
        return {
          type: "Feature",
          properties: item,
          geometry: {
            type: "Polygon",
            coordinates: item.geometry.coordinates
          }
        };
      })
    };

    // Iterate over the geojson features and calculate the average inspection score for each zip code
    geojson.features.forEach(feature => {
      let zipCode = feature.properties.zip_code || feature.properties.zip || feature.properties.business_postal_code;

      // Check if the zip code exists in the inspectionScores object
      if (zipCode in inspectionScores) {
        let score = inspectionScores[zipCode];
        feature.properties.average_inspection_score = score;
      } else {
        feature.properties.average_inspection_score = undefined;
      }
    });

    // Determine the minimum and maximum inspection scores
    let scores = Object.values(inspectionScores).filter(score => score !== undefined);
    let minScore = Math.min(...scores);
    let maxScore = Math.max(...scores);

    // Create the choropleth layer using L.choropleth
let choroplethLayer = L.choropleth(geojson, {
  valueProperty: "average_inspection_score",
  scale: ["#808080", "red", "yellow", "green"], // Gray, Red, Yellow, Green for the color scale
  steps: 4,
  mode: "q",
  style: {
    color: "blue",
    weight: 0.5,
    fillOpacity: 0.7
  },
  onEachFeature: (feature, layer) => {
    let zipCode = feature.properties.zip_code || feature.properties.zip || feature.properties.business_postal_code;
    let score = feature.properties.average_inspection_score;
    let popupContent = "SF Public Health Data" + "<br>" + "Zip Code: " + zipCode + "<br>";

    if (score !== undefined) {
      popupContent += "Average Inspection Score: " + (score ? score.toFixed(0) : "No data");
    } else {
      popupContent += "No data";
    }

    layer.bindPopup(popupContent);

    layer.on("click", () => {
      console.log(feature); // Log the feature data when clicked on the map
    });
  },
  
  // Assigning color range based on avg. insp. score.
  getColor: (value) => {
    if (value === undefined) {
      return "#808080"; // Assign gray color to "No Data"
    } else if (value >= 90) {
      return "green"; // Assign green color to range 90 and above
    } else if (value >= 85) {
      return "yellow"; // Assign yellow color to range 85-89
    } else if (value >= 81) {
      return "red"; // Assign red color to range 81-84
    } else {
      return "#808080"; // Assign gray color to any other value outside the specified ranges
    }
  }
  
  
}).addTo(myMap);

// Set up the legend.
var legend = L.control({ position: "bottomright" });
legend.onAdd = function() {
  var div = L.DomUtil.create("div", "legend");
  var limits = ["No Data", "81-84", "85-89", "90-100"];
  var colors = ["#808080", "red", "yellow", "green"];

  let labels = [];

  // Add the legend title.
  div.innerHTML += '<h4 style="text-align: center;">SF Public Health Inspection Scores<br><span style="font-size: 14px; font-weight: bold;">by zip code</span></h4>';

  // Create the legend color bar.
  for (var i = 0; i < limits.length; i++) {
    var colorRange = limits[i];
    div.innerHTML +=
      '<i style="background:' + colors[i] + '"></i> ' +
      colorRange + '<br>';
  }

  return div;
};

// Adding the legend to the map
legend.addTo(myMap);



    // Fit the map bounds to the choropleth layer
    myMap.fitBounds(choroplethLayer.getBounds());
  })
  .catch(function(error) {
    console.error('Error fetching JSON data:', error);
  });
});
