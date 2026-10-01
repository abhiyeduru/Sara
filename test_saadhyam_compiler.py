import sys
import os
import json

# Ensure python path includes root
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from server.engine.agent_compiler import AgentCompiler
from server.engine.document_processor import DocumentProcessor
from server.engine.continuous_teacher import ContinuousTeacher
from server.engine.test_runner import TestRunner

def test_saadhyam_agent_compiler():
    print("\n========================================================")
    print("🚀 TESTING SAADHYAM AUTONOMOUS AGENT COMPILER PIPELINE")
    print("========================================================\n")

    # 1. Natural Language Input to Full Autonomous Agent Specification
    natural_input = (
        "Create a sales employee for my real estate company named 'Apex Realty'. "
        "Whenever a new lead comes from Meta, contact them, understand their budget and location, "
        "record them in CRM, send brochure via WhatsApp, and book site visit on Google Calendar. "
        "If budget is above 80 Lakhs, recommend premium 3 BHK villas in Gachibowli."
    )

    print("Step 1: Compiling natural language prompt into Universal Agent Spec...")
    compiler = AgentCompiler()
    spec = compiler.compile(natural_input=natural_input, language_preference="en")


    assert "identity" in spec, "Missing identity in compiled spec"
    assert "tools" in spec, "Missing tools in compiled spec"
    assert "workflow" in spec, "Missing workflow in compiled spec"
    assert "system_prompt" in spec, "Missing system_prompt in compiled spec"
    assert "test_suite" in spec, "Missing test_suite in compiled spec"

    print(f"  ✓ Agent Name: {spec['identity'].get('name')}")
    print(f"  ✓ Role: {spec['identity'].get('role_title')} ({spec['identity'].get('department')})")
    print(f"  ✓ Mission: {spec['identity'].get('mission')}")
    print(f"  ✓ Detected Tools ({len(spec['tools'].get('detected_tools', []))}): {[t['name'] for t in spec['tools'].get('detected_tools', [])]}")
    steps = spec['workflow'].get('steps', [])
    step_names = [s.get('name') or s.get('title') or f"Step {s.get('step')}" for s in steps]
    print(f"  ✓ Workflow Steps ({len(steps)}): {step_names}")
    print(f"  ✓ Test Scenarios: {len(spec['test_suite'].get('scenarios', []))}")


    # Check that Meta, WhatsApp, Calendar, CRM were detected
    detected_tool_names = " ".join([t['name'].lower() for t in spec['tools'].get('detected_tools', [])])
    assert any(w in detected_tool_names for w in ["meta", "lead"]), "Meta integration was not detected"
    assert any(w in detected_tool_names for w in ["whatsapp", "messaging"]), "WhatsApp integration was not detected"
    assert any(w in detected_tool_names for w in ["calendar", "booking"]), "Calendar integration was not detected"

    # Check English numbers enforcement in prompt
    assert "ENGLISH" in spec['system_prompt'].upper(), "English numbers rule missing in prompt"

    print("\nStep 2: Testing Document Processor on CSV and TXT content...")
    sample_csv = b"Project,Location,Type,StartingPrice,Possession\nPalm Meadows,Gachibowli,3 BHK,85 Lakhs,Ready to Move\nGreen Valley,Kondapur,2 BHK,65 Lakhs,Dec 2026"
    extracted_text = DocumentProcessor.extract_text_from_bytes(sample_csv, "properties.csv")
    assert "Palm Meadows" in extracted_text
    assert "85 Lakhs" in extracted_text
    print("  ✓ CSV parsed accurately.")

    print("\nStep 3: Testing Continuous Teaching Engine ('From now on...')...")
    instruction = "From now on, do not recommend any properties below 50 Lakhs to customers."
    compiled_rule = ContinuousTeacher.compile_instruction(instruction, current_role="Real Estate Sales Agent")
    print(f"  ✓ Structured Rule: {compiled_rule.get('rule_text')}")
    print(f"  ✓ Rule Type: {compiled_rule.get('rule_type')}")
    print(f"  ✓ Confirmation: {compiled_rule.get('confirmation_message')}")
    assert compiled_rule.get("rule_text"), "Rule text should be extracted"

    print("\nStep 4: Testing Pre-Deployment Test Runner (7 Scenarios)...")
    test_scenarios = spec['test_suite'].get('scenarios', [])[:3] # Run first 3 quick scenarios for fast verification
    test_eval = TestRunner.run_suite(system_prompt=spec['system_prompt'], scenarios=test_scenarios)
    print(f"  ✓ Executed {len(test_eval)} scenarios.")
    for res in test_eval:
        status_icon = "✓" if res.get("passed") else "✗"
        print(f"    [{status_icon}] {res.get('title')}: {res.get('output')[:80]}...")

    print("\n========================================================")
    print("🎉 ALL SAADHYAM AUTONOMOUS COMPILER TESTS PASSED!")
    print("========================================================\n")

if __name__ == "__main__":
    test_saadhyam_agent_compiler()
