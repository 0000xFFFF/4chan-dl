# Function to create a virtual environment using the available Python command
create_venv() {
    command=$1
    echo "Attempting to create virtual environment with $command..."
    if $command -m venv p3env; then
        source p3env/bin/activate
        echo "Virtual environment created and activated with $command"
        return 0
    else
        echo "Failed to create virtual environment with $command"
        return 1
    fi
}

# Attempt to create the virtual environment with python
if create_venv python; then
    echo "Virtual environment created with python"
elif create_venv python3; then
    echo "Virtual environment created with python3"
else
    echo "Failed to create virtual environment with both python and python3"
    exit 1
fi

# Check if already inside a virtual environment before upgrading pip and installing requirements
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Not inside a virtual environment. Exiting..."
    exit 1
else
    echo "Inside a virtual environment. Proceeding..."
fi

# Upgrade pip
pip install --upgrade pip

# Install the requirements
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
else
    echo "requirements.txt not found"
    exit 1
fi
