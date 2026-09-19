"""Explainable LangGraph workflow used by the recovery agent."""
from typing import TypedDict
from langgraph.graph import StateGraph, END

class RecoveryState(TypedDict, total=False):
    transcript: str
    intent: str
    escalation: bool
    reason: str
    next_step: str

def route(state: RecoveryState):
    text = state.get("transcript", "").lower()
    rules = [("DNC request", ["stop calling", "don't call", "do not call"]), ("Human requested", ["human", "person", "agent"]), ("Sensitive topic", ["payment", "card number", "complaint"]), ("Frustration detected", ["already told", "done with this", "three of you"])]
    for reason, phrases in rules:
        if any(p in text for p in phrases): return {"escalation": True, "reason": reason, "next_step": "handoff"}
    return {"escalation": False, "reason": "", "next_step": "continue_script"}

def build_recovery_graph():
    graph = StateGraph(RecoveryState)
    graph.add_node("safety_router", route)
    graph.set_entry_point("safety_router")
    graph.add_edge("safety_router", END)
    return graph.compile()

recovery_graph = build_recovery_graph()
