use hashbrown::HashMap;

pub struct LSystem {
    pub axiom: String,
    pub rules: HashMap<char, String>,
    pub iterations: u32,
}

impl LSystem {
    pub fn new() -> LSystemBuilder {
        LSystemBuilder::default()
    }

    pub fn generate(&self) -> String {
        let mut result = String::new();

        for c in self.axiom.chars() {
            result.push(c);
        }

        for _ in 0..self.iterations {
            let mut new_result = String::new();
            for c in result.chars() {
                if let Some(rule) = self.rules.get(&c) {
                    new_result.push_str(rule);
                } else {
                    new_result.push(c);
                }
            }
            result = new_result;
        }

        result
    }
}

// The builder for LSystems
#[derive(Default)]
pub struct LSystemBuilder {
    axiom: String,
    rules: HashMap<char, String>,
    iterations: u32,
}

impl LSystemBuilder {
    pub fn new() -> LSystemBuilder {
        LSystemBuilder {
            axiom: String::new(),
            rules: HashMap::new(),
            iterations: 0,
        }
    }

    pub fn axiom(mut self, axiom: &str) -> LSystemBuilder {
        self.axiom = axiom.to_owned();
        self
    }

    pub fn rule(mut self, key: char, value: &str) -> LSystemBuilder {
        self.rules.insert(key, value.to_owned());
        self
    }

    pub fn iterations(mut self, iterations: u32) -> LSystemBuilder {
        self.iterations = iterations;
        self
    }

    pub fn build(self) -> LSystem {
        LSystem {
            axiom: self.axiom,
            rules: self.rules,
            iterations: self.iterations,
        }
    }
}
