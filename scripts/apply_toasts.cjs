const fs = require('fs');

function replaceFileContent(filename, replacers) {
  if (!fs.existsSync(filename)) return;
  let content = fs.readFileSync(filename, 'utf8');
  for (const { from, to } of replacers) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(filename, content, 'utf8');
}

// 1. TaskModal.tsx
replaceFileContent('src/components/TaskModal.tsx', [
  // comments
  { from: "setComments(comments.filter(c => c.id !== commentId));", to: "setComments(comments.filter(c => c.id !== commentId));\n      success('Comment deleted');" },
  { from: "const data = await res.json();\n      setComments([...comments, data]);\n      setNewComment('');", to: "const data = await res.json();\n      setComments([...comments, data]);\n      setNewComment('');\n      success('Comment added');" },
  { from: "alert(\"Please enter a Task Title.\");", to: "error(\"Please enter a Task Title.\");" },
  { from: "alert(\"Please select a Project. This is a mandatory field.\");", to: "error(\"Please select a Project. This is a mandatory field.\");" },
  { from: "alert(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);", to: "error(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);" },
  // branches
  { from: "setFormData(prev => ({ ...prev, branchName: data.branchName }));", to: "setFormData(prev => ({ ...prev, branchName: data.branchName }));\n        success('Branch created successfully');" }
]);

// 2. Dashboard.tsx
replaceFileContent('src/pages/Dashboard.tsx', [
  { from: "setSelectedTask(null);\n        setIsModalOpen(false);\n        fetchData();", to: "setSelectedTask(null);\n        setIsModalOpen(false);\n        fetchData();\n        success(isEdit ? 'Task updated' : 'Task created');" },
  { from: "alert(`Failed to save task: ${errData}`);", to: "error(`Failed to save task: ${errData}`);" },
  { from: "alert(`Error saving task: ${err.message}`);", to: "error(`Error saving task: ${err.message}`);" },
  { from: "fetchData();\n    } catch (err) {\n      console.error(err);\n    }\n  };\n\n  const handleDeleteTask = async (taskId: string) => {",
    to: "fetchData();\n      if (updates.status === 'done') {\n        success('Task completed');\n      } else {\n        success('Task updated');\n      }\n    } catch (err) {\n      error('Failed to update task');\n      console.error(err);\n    }\n  };\n\n  const handleDeleteTask = async (taskId: string) => {"
  },
  { from: "fetchData();\n    } catch (err) {\n      console.error(err);\n    }\n  };\n\n  const [columns",
    to: "fetchData();\n      success('Task deleted');\n    } catch (err) {\n      error('Failed to delete task');\n      console.error(err);\n    }\n  };\n\n  const [columns"
  }
]);

// 3. Board.tsx
replaceFileContent('src/pages/Board.tsx', [
  { from: "setSelectedTask(null);\n        setIsModalOpen(false);\n        fetchData();", to: "setSelectedTask(null);\n        setIsModalOpen(false);\n        fetchData();\n        success(isEdit ? 'Task updated' : 'Task created');" },
  { from: "alert(`Failed to save task: ${errData}`);", to: "error(`Failed to save task: ${errData}`);" },
  { from: "alert(`Error saving task: ${err.message}`);", to: "error(`Error saving task: ${err.message}`);" },
  { from: "alert(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);", to: "error(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);" },
  // update task and delete task similar manually
  { from: "fetchData();\n    } catch (err) {\n      console.error(err);\n    }\n  };\n\n  const handleDeleteTask = async (taskId: string) => {",
    to: "fetchData();\n      if (updates.status === 'done') {\n        success('Task completed');\n      } else {\n        success(updates.orderIndex !== undefined && Object.keys(updates).length === 1 ? 'Task reordered' : 'Task updated');\n      }\n    } catch (err) {\n      error('Failed to update task');\n      console.error(err);\n    }\n  };\n\n  const handleDeleteTask = async (taskId: string) => {"
  },
  { from: "      fetchData();\n    } catch (err) {\n      console.error(err);\n    }\n  };\n\n  return (",
    to: "      fetchData();\n      success('Task deleted');\n    } catch (err) {\n      error('Failed to delete task');\n      console.error(err);\n    }\n  };\n\n  return ("
  }
]);

// 4. Projects.tsx
replaceFileContent('src/pages/Projects.tsx', [
  { from: "setIsModalOpen(false);\n        fetchProjects();", to: "setIsModalOpen(false);\n        fetchProjects();\n        success(editingProject ? 'Project updated' : 'Project created');" },
  { from: "alert(`Failed to save project: ${errData}`);", to: "error(`Failed to save project`);" },
  { from: "alert('Error saving project');", to: "error('Error saving project');" }
]);

// 5. Planning.tsx (milestones)
replaceFileContent('src/pages/Planning.tsx', [
  // when saving milestone
  { from: "setIsMilestoneModalOpen(false);\n        fetchProjectData(selectedProject);\n      } else {", to: "setIsMilestoneModalOpen(false);\n        fetchProjectData(selectedProject);\n        success(editingMilestone ? 'Milestone updated' : 'Milestone added');\n      } else {" },
  { from: "alert(`Failed to save milestone: ${errData}`);", to: "error(`Failed to save milestone`);" },
  // when save feature
  { from: "setIsFeatureModalOpen(false);\n        fetchProjectData(selectedProject);\n      } else {", to: "setIsFeatureModalOpen(false);\n        fetchProjectData(selectedProject);\n        success('Feature requested');\n      } else {" },
  // branch
  { from: "setBranchName(data.branchName);\n      } else {", to: "setBranchName(data.branchName);\n        success('Branch created');\n      } else {" }
]);

console.log("Done");
