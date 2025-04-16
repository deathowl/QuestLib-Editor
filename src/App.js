import React, { useState, useEffect, useRef } from "react";
import * as d3 from "d3";

const REQUEST_TYPES = [
  { value: 0, label: "KILL" },
  { value: 1, label: "GATHER" },
  { value: 2, label: "USE" },
  { value: 3, label: "VISIT" },
  { value: 4, label: "TALK" },
];

const QuestEditor = () => {
  const [quests, setQuests] = useState([]);
  const [selectedQuestId, setSelectedQuestId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [questFormData, setQuestFormData] = useState({
    id: "",
    description: "",
    ongoing: "",
    onfinished: "",
    questgivers: [],
    prerequisites: [],
    required: [],
  });
  const [newRequirement, setNewRequirement] = useState({
    id: "",
    type: 0,
    count: 1,
  });
  const [newPrerequisite, setNewPrerequisite] = useState("");
  const [newQuestgiver, setNewQuestgiver] = useState("");
  const [filename, setFilename] = useState("quests.json");

  const svgRef = useRef();

  const selectQuest = (questId) => {
    const quest = quests.find((q) => q.id === parseInt(questId));
    if (quest) {
      setSelectedQuestId(quest.id);
      setQuestFormData({
        id: quest.id,
        description: quest.description || "",
        ongoing: quest.ongoing || "",
        onfinished: quest.onfinished || "",
        questgivers: quest.questgivers || [],
        prerequisites: quest.prerequisites || [],
        required: quest.required || [],
      });
    } else {
      resetForm();
    }
  };

  const resetForm = () => {
    setSelectedQuestId(null);
    setQuestFormData({
      id: nextAvailableId(),
      description: "",
      ongoing: "",
      onfinished: "",
      questgivers: [],
      prerequisites: [],
      required: [],
    });
  };

  const nextAvailableId = () => {
    if (quests.length === 0) return 1;
    return Math.max(...quests.map((q) => q.id)) + 1;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuestFormData({
      ...questFormData,
      [name]: name === "id" ? parseInt(value) : value,
    });
  };

  const handleRequirementChange = (e) => {
    const { name, value } = e.target;
    setNewRequirement({
      ...newRequirement,
      [name]:
        name === "id" || name === "count" || name === "type"
          ? parseInt(value)
          : value,
    });
  };

  const addRequirement = () => {
    if (newRequirement.id && newRequirement.count > 0) {
      setQuestFormData({
        ...questFormData,
        required: [...questFormData.required, { ...newRequirement }],
      });
      setNewRequirement({ id: "", type: 0, count: 1 });
    }
  };

  const removeRequirement = (index) => {
    const updatedRequirements = [...questFormData.required];
    updatedRequirements.splice(index, 1);
    setQuestFormData({
      ...questFormData,
      required: updatedRequirements,
    });
  };

  const addPrerequisite = () => {
    if (
      newPrerequisite &&
      !questFormData.prerequisites.includes(parseInt(newPrerequisite))
    ) {
      setQuestFormData({
        ...questFormData,
        prerequisites: [
          ...questFormData.prerequisites,
          parseInt(newPrerequisite),
        ],
      });
      setNewPrerequisite("");
    }
  };

  const removePrerequisite = (prereqId) => {
    setQuestFormData({
      ...questFormData,
      prerequisites: questFormData.prerequisites.filter(
        (id) => id !== prereqId
      ),
    });
  };

  const addQuestgiver = () => {
    if (
      newQuestgiver &&
      !questFormData.questgivers.includes(parseInt(newQuestgiver))
    ) {
      setQuestFormData({
        ...questFormData,
        questgivers: [...questFormData.questgivers, parseInt(newQuestgiver)],
      });
      setNewQuestgiver("");
    }
  };

  const removeQuestgiver = (giverId) => {
    setQuestFormData({
      ...questFormData,
      questgivers: questFormData.questgivers.filter((id) => id !== giverId),
    });
  };

  const saveQuest = () => {
    if (
      !questFormData.id ||
      !questFormData.description ||
      !questFormData.required.length
    ) {
      alert(
        "Please fill in required fields: ID, Description, and at least one Requirement"
      );
      return;
    }

    const questIndex = quests.findIndex((q) => q.id === questFormData.id);

    if (questIndex >= 0) {
      const updatedQuests = [...quests];
      updatedQuests[questIndex] = { ...questFormData };
      setQuests(updatedQuests);
    } else {
      setQuests([...quests, { ...questFormData }]);
    }

    resetForm();

    updateGraph();
  };

  const deleteQuest = (id) => {
    const updatedQuests = quests.filter((q) => q.id !== id);

    for (let i = 0; i < updatedQuests.length; i++) {
      if (
        updatedQuests[i].prerequisites &&
        updatedQuests[i].prerequisites.includes(id)
      ) {
        updatedQuests[i].prerequisites = updatedQuests[i].prerequisites.filter(
          (prereqId) => prereqId !== id
        );
      }
    }

    setQuests(updatedQuests);

    if (selectedQuestId === id) {
      resetForm();
    }

    updateGraph();
  };

  const clearEverything = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all quests? This cannot be undone."
      )
    ) {
      setQuests([]);
      resetForm();
      setGraphNodes([]);
      setGraphLinks([]);
      if (simulation) {
        simulation.stop();
        setSimulation(null);
      }
      updateGraph([], true);
    }
  };

  const saveToJson = () => {
    const json = JSON.stringify(quests, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const loadFromJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFilename(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const loadedQuests = JSON.parse(event.target.result);
        setQuests(loadedQuests);
        setTimeout(() => {
          setGraphNodes([]);
          setGraphLinks([]);
          if (simulation) {
            simulation.stop();
            setSimulation(null);
          }
          updateGraph(loadedQuests, true);
        }, 100);
      } catch (error) {
        alert("Failed to parse JSON: " + error.message);
      }
    };
    reader.readAsText(file);
  };

  const [graphNodes, setGraphNodes] = useState([]);
  const [graphLinks, setGraphLinks] = useState([]);
  const [simulation, setSimulation] = useState(null);

  const updateGraph = (questData = quests, forceRecreate = false) => {
    if (!svgRef.current) return;

    const container = svgRef.current.parentElement;
    const width = container.clientWidth || 300;
    const height = 500;

    if (
      simulation &&
      !forceRecreate &&
      questData.length === graphNodes.length
    ) {
      updateNodeColors();
      return;
    }

    d3.select(svgRef.current).selectAll("*").remove();

    if (questData.length === 0) return;

    const nodes = questData.map((q) => ({
      id: q.id,
      label:
        q.description.substring(0, 20) +
        (q.description.length > 20 ? "..." : ""),
    }));

    const links = [];
    questData.forEach((quest) => {
      if (quest.prerequisites && quest.prerequisites.length) {
        quest.prerequisites.forEach((prereqId) => {
          links.push({
            source: prereqId,
            target: quest.id,
          });
        });
      }
    });

    setGraphNodes(nodes);
    setGraphLinks(links);

    if (simulation) {
      simulation.stop();
    }

    const newSimulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .id((d) => d.id)
          .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX(width / 2).strength(0.1))
      .force("y", d3.forceY(height / 2).strength(0.1));

    setSimulation(newSimulation);

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("class", darkMode ? "text-gray-200" : "text-gray-800");

    const link = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("stroke", darkMode ? "#aaa" : "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#arrow)");

    svg
      .append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 15)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", darkMode ? "#aaa" : "#999");

    const nodeGroup = svg.append("g").attr("class", "nodes-group");

    const node = nodeGroup
      .selectAll("g")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("data-id", (d) => d.id)
      .call(
        d3
          .drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended)
      );

    node.on("click", function (event, d) {
      selectQuest(d.id);
      event.stopPropagation();
    });

    node
      .append("circle")
      .attr("r", 10)
      .attr("fill", (d) =>
        selectedQuestId === d.id ? "#ff6347" : darkMode ? "#88d1c0" : "#69b3a2"
      )
      .attr("class", "node-circle")
      .attr("data-id", (d) => d.id);

    node
      .append("text")
      .attr("dy", -15)
      .attr("text-anchor", "middle")
      .text((d) => `ID: ${d.id}`)
      .attr("font-size", "10px")
      .attr("fill", darkMode ? "#e2e8f0" : "#1a202c");

    node
      .append("text")
      .attr("dy", 25)
      .attr("text-anchor", "middle")
      .text((d) => d.label)
      .attr("font-size", "10px")
      .attr("fill", darkMode ? "#e2e8f0" : "#1a202c");

    newSimulation.on("tick", () => {
      link
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y);

      node.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event, d) {
      if (!event.active) newSimulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event, d) {
      if (!event.active) newSimulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
  };

  const updateNodeColors = () => {
    d3.select(svgRef.current)
      .selectAll(".node-circle")
      .attr("fill", function () {
        const nodeId = parseInt(d3.select(this).attr("data-id"));
        return nodeId === selectedQuestId
          ? "#ff6347"
          : darkMode
          ? "#88d1c0"
          : "#69b3a2";
      });

    d3.select(svgRef.current)
      .selectAll("text")
      .attr("fill", darkMode ? "#e2e8f0" : "#1a202c");
  };

  useEffect(() => {
    resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("sample-quests.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load sample quests");
        }
        return response.json();
      })
      .then((data) => {
        setQuests(data);
        setFilename("sample-quests.json");
      })
      .catch((error) => {
        console.error("Error loading sample quests:", error);
      });
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem("questEditorDarkMode", newMode ? "true" : "false");
  };

  useEffect(() => {
    const storedDarkMode = localStorage.getItem("questEditorDarkMode");
    if (storedDarkMode) {
      setDarkMode(storedDarkMode === "true");
    } else {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setDarkMode(prefersDark);
    }
  }, []);

  useEffect(() => {
    if (quests.length > 0) {
      updateGraph(quests, true);
    }
  }, [darkMode]);

  useEffect(() => {
    if (quests.length !== graphNodes.length) {
      updateGraph(quests, true);
    } else {
      updateNodeColors();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests, selectedQuestId]);

  useEffect(() => {
    const handleResize = () => {
      updateGraph(quests, true);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quests]);

  return (
    <div
      className={`flex flex-col h-screen ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      }`}
    >
      <div
        className={`${
          darkMode ? "bg-gray-900" : "bg-gray-800"
        } text-white p-4 flex justify-between items-center`}
      >
        <h1 className="text-2xl font-bold">Quest Editor</h1>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-full focus:outline-none"
        >
          {darkMode ? (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Quest list */}
        <div
          className={`w-1/4 ${
            darkMode ? "bg-gray-800" : "bg-gray-100"
          } p-4 overflow-auto`}
        >
          <div className="flex justify-between mb-4">
            <button
              onClick={resetForm}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              New Quest
            </button>
            <label className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 cursor-pointer">
              Load JSON
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={loadFromJson}
              />
            </label>
          </div>

          <button
            onClick={saveToJson}
            className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 mb-4"
          >
            Save to JSON
          </button>

          <input
            type="text"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className={`w-full p-2 mb-4 border rounded ${
              darkMode
                ? "bg-gray-700 text-white border-gray-600"
                : "bg-white text-gray-900 border-gray-300"
            }`}
            placeholder="Filename"
          />

          <h2
            className={`font-bold text-lg mb-2 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            Quest List
          </h2>

          {quests.length === 0 ? (
            <p className={`${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              No quests created yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {quests.map((quest) => (
                <li
                  key={quest.id}
                  className={`p-2 rounded cursor-pointer flex justify-between ${
                    selectedQuestId === quest.id
                      ? darkMode
                        ? "bg-blue-800"
                        : "bg-blue-200"
                      : darkMode
                      ? "bg-gray-700 hover:bg-gray-600"
                      : "bg-white hover:bg-blue-100"
                  }`}
                  onClick={() => selectQuest(quest.id)}
                >
                  <div>
                    <div className="font-bold">ID: {quest.id}</div>
                    <div className="text-sm truncate" title={quest.description}>
                      {quest.description.substring(0, 30)}
                      {quest.description.length > 30 ? "..." : ""}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteQuest(quest.id);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Middle panel - Form */}
        <div
          className={`w-1/2 p-4 overflow-auto ${
            darkMode ? "bg-gray-900" : "bg-white"
          }`}
        >
          <h2 className="font-bold text-xl mb-4">
            {selectedQuestId
              ? `Edit Quest #${selectedQuestId}`
              : "Create New Quest"}
          </h2>

          <div className="space-y-4">
            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Quest ID
              </label>
              <input
                type="number"
                name="id"
                value={questFormData.id}
                onChange={handleInputChange}
                className={`w-full p-2 border rounded ${
                  darkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
                min="1"
                required
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Description
              </label>
              <textarea
                name="description"
                value={questFormData.description}
                onChange={handleInputChange}
                className={`w-full p-2 border rounded ${
                  darkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
                rows="3"
                required
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Ongoing Text
              </label>
              <textarea
                name="ongoing"
                value={questFormData.ongoing}
                onChange={handleInputChange}
                className={`w-full p-2 border rounded ${
                  darkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
                rows="2"
              />
            </div>

            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Completed Text
              </label>
              <textarea
                name="onfinished"
                value={questFormData.onfinished}
                onChange={handleInputChange}
                className={`w-full p-2 border rounded ${
                  darkMode
                    ? "bg-gray-700 text-white border-gray-600"
                    : "bg-white text-gray-900 border-gray-300"
                }`}
                rows="2"
              />
            </div>

            {/* Quest givers section */}
            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Quest Givers
              </label>
              <div className="flex space-x-2 mb-2">
                <input
                  type="number"
                  value={newQuestgiver}
                  onChange={(e) => setNewQuestgiver(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                  placeholder="Enter NPC ID"
                  min="1"
                />
                <button
                  onClick={addQuestgiver}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {questFormData.questgivers?.map((giverId) => (
                  <div
                    key={giverId}
                    className={`${
                      darkMode ? "bg-gray-700" : "bg-gray-200"
                    } px-3 py-1 rounded flex items-center space-x-2`}
                  >
                    <span>NPC ID: {giverId}</span>
                    <button
                      onClick={() => removeQuestgiver(giverId)}
                      className={`${
                        darkMode
                          ? "text-red-400 hover:text-red-300"
                          : "text-red-500 hover:text-red-700"
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Prerequisites section */}
            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Prerequisites
              </label>
              <div className="flex space-x-2 mb-2">
                <select
                  value={newPrerequisite}
                  onChange={(e) => setNewPrerequisite(e.target.value)}
                  className={`w-full p-2 border rounded ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                >
                  <option value="">Select a quest</option>
                  {quests
                    .filter((q) => q.id !== questFormData.id)
                    .map((q) => (
                      <option key={q.id} value={q.id}>
                        ID: {q.id} - {q.description.substring(0, 20)}
                        {q.description.length > 20 ? "..." : ""}
                      </option>
                    ))}
                </select>
                <button
                  onClick={addPrerequisite}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {questFormData.prerequisites?.map((prereqId) => {
                  const prereqQuest = quests.find((q) => q.id === prereqId);
                  return (
                    <div
                      key={prereqId}
                      className={`${
                        darkMode ? "bg-gray-700" : "bg-gray-200"
                      } px-3 py-1 rounded flex items-center space-x-2`}
                    >
                      <span title={prereqQuest?.description || "Unknown quest"}>
                        Quest #{prereqId}
                      </span>
                      <button
                        onClick={() => removePrerequisite(prereqId)}
                        className={`${
                          darkMode
                            ? "text-red-400 hover:text-red-300"
                            : "text-red-500 hover:text-red-700"
                        }`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Requirements section */}
            <div>
              <label
                className={`block text-sm font-medium ${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } mb-1`}
              >
                Requirements
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input
                  type="number"
                  name="id"
                  value={newRequirement.id}
                  onChange={handleRequirementChange}
                  className={`p-2 border rounded ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                  placeholder="Subject ID"
                  min="1"
                />

                <select
                  name="type"
                  value={newRequirement.type}
                  onChange={handleRequirementChange}
                  className={`p-2 border rounded ${
                    darkMode
                      ? "bg-gray-700 text-white border-gray-600"
                      : "bg-white text-gray-900 border-gray-300"
                  }`}
                >
                  {REQUEST_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <div className="flex space-x-2">
                  <input
                    type="number"
                    name="count"
                    value={newRequirement.count}
                    onChange={handleRequirementChange}
                    className={`p-2 border rounded flex-1 ${
                      darkMode
                        ? "bg-gray-700 text-white border-gray-600"
                        : "bg-white text-gray-900 border-gray-300"
                    }`}
                    placeholder="Count"
                    min="1"
                  />
                  <button
                    onClick={addRequirement}
                    className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {questFormData.required.length === 0 ? (
                <p
                  className={`${darkMode ? "text-gray-400" : "text-gray-500"}`}
                >
                  No requirements added yet.
                </p>
              ) : (
                <table
                  className={`w-full border-collapse ${
                    darkMode ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  <thead>
                    <tr
                      className={`${darkMode ? "bg-gray-700" : "bg-gray-200"}`}
                    >
                      <th
                        className={`border ${
                          darkMode ? "border-gray-600" : "border-gray-300"
                        } p-2 text-left`}
                      >
                        Subject ID
                      </th>
                      <th
                        className={`border ${
                          darkMode ? "border-gray-600" : "border-gray-300"
                        } p-2 text-left`}
                      >
                        Type
                      </th>
                      <th
                        className={`border ${
                          darkMode ? "border-gray-600" : "border-gray-300"
                        } p-2 text-left`}
                      >
                        Count
                      </th>
                      <th
                        className={`border ${
                          darkMode ? "border-gray-600" : "border-gray-300"
                        } p-2 text-left`}
                      >
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {questFormData.required.map((req, index) => (
                      <tr
                        key={index}
                        className={`${
                          darkMode ? "hover:bg-gray-800" : "hover:bg-gray-100"
                        }`}
                      >
                        <td
                          className={`border ${
                            darkMode ? "border-gray-600" : "border-gray-300"
                          } p-2`}
                        >
                          {req.id}
                        </td>
                        <td
                          className={`border ${
                            darkMode ? "border-gray-600" : "border-gray-300"
                          } p-2`}
                        >
                          {
                            REQUEST_TYPES.find((t) => t.value === req.type)
                              ?.label
                          }
                        </td>
                        <td
                          className={`border ${
                            darkMode ? "border-gray-600" : "border-gray-300"
                          } p-2`}
                        >
                          {req.count}
                        </td>
                        <td
                          className={`border ${
                            darkMode ? "border-gray-600" : "border-gray-300"
                          } p-2`}
                        >
                          <button
                            onClick={() => removeRequirement(index)}
                            className={`${
                              darkMode
                                ? "text-red-400 hover:text-red-300"
                                : "text-red-500 hover:text-red-700"
                            }`}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              onClick={saveQuest}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Save Quest
            </button>
          </div>
        </div>

        {/* Right panel - Graph visualization */}
        <div
          className={`w-1/4 p-4 overflow-auto flex flex-col ${
            darkMode ? "bg-gray-800" : "bg-white"
          }`}
        >
          <h2
            className={`font-bold text-lg mb-2 ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            Quest Dependency Graph
          </h2>
          <button
            onClick={clearEverything}
            className="mb-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            New Graph
          </button>
          <div
            className={`flex-1 border rounded p-2 ${
              darkMode
                ? "bg-gray-900 border-gray-700"
                : "bg-white border-gray-300"
            } overflow-hidden`}
          >
            <svg
              ref={svgRef}
              className="w-full h-full"
              onClick={() => setSelectedQuestId(null)}
              preserveAspectRatio="xMidYMid meet"
            />
          </div>
          <div
            className={`mt-2 text-sm ${
              darkMode ? "text-gray-400" : "text-gray-600"
            }`}
          >
            <p>Click on a node to edit that quest.</p>
            <p>Drag nodes to rearrange the graph.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestEditor;
